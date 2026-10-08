const DEFAULT_MODEL = 'gemini-3.8-flash';
const TRANSCRIBE_MODEL = 'gemini-3.5-transcribe';

// Flag volátil por ciclo do service worker: uma vez que 'smart' falhe por
// erro de thinking, pula direto pro modo padrão (que sempre transcreve).
let smartUnsupported = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === 'listAudioModels') {
    (async () => {
      try {
        const apiKey = await getActiveApiKey();
        if (!apiKey) throw new Error('Configure suas chaves Gemini no painel administrativo primeiro.');
        const models = await listAudioModels(apiKey.key);
        sendResponse({ success: true, models });
      } catch (error) {
        sendResponse({ success: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  if (message?.action !== 'transcribeAudio') return;

  (async () => {
    const triedKeyIds = [];
    let lastError = null;

    try {
      const { selectedModel = DEFAULT_MODEL } = await chrome.storage.local.get('selectedModel');
      const model = sanitizeModel(selectedModel);
      const dataUrl = message.audioData || await urlToDataUrl(message.audioUrl);

      // Loop de tentativa pelo pool de chaves
      while (true) {
        let apiKey = null;
        try {
          apiKey = await getActiveApiKey(triedKeyIds);
        } catch (keyErr) {
          throw lastError || keyErr;
        }

        if (!apiKey) {
          throw new Error('Configure suas chaves Gemini no painel administrativo.');
        }

        triedKeyIds.push(apiKey.id);

        try {
          const transcript = model === TRANSCRIBE_MODEL
            ? await transcribeWithDedicatedModel(dataUrl, apiKey.key)
            : await transcribeWithGemini(dataUrl, apiKey.key, model);

          await incrementKeyUsage(apiKey.id);
          sendResponse({ success: true, data: transcript });
          return;
        } catch (error) {
          console.error(`[WGT] Falha com a chave ${apiKey.id}:`, error);
          lastError = error;

          if (isRateLimitError(error)) {
            const cooldownMs = parseRateLimitCooldown(error?.message);
            const until = Date.now() + cooldownMs;
            await markKeyAsLimited(apiKey.id, until);
            console.log(`[WGT] Chave ${apiKey.id} em cooldown por ${Math.round(cooldownMs / 1000)}s. Tentando próxima chave do pool...`);
            // Continua no while para tentar a próxima chave disponível
            continue;
          }

          // Erros não relacionados a cota/rate-limit são propagados imediatamente
          throw error;
        }
      }
    } catch (finalError) {
      console.error('[WGT] Transcription error:', finalError);
      sendResponse({ success: false, error: finalError?.message || String(finalError) });
    }
  })();

  return true;
});

// Identifica se o erro é decorrente de limites de taxa ou cota
function isRateLimitError(error) {
  const msg = (error?.message || String(error || '')).toLowerCase();
  return msg.includes('quota') ||
         msg.includes('rate limit') ||
         msg.includes('resource_exhausted') ||
         msg.includes('429');
}

// Extrai o tempo de espera do erro retornado pela API do Gemini
function parseRateLimitCooldown(errorMessage) {
  if (!errorMessage || typeof errorMessage !== 'string') return 60000;

  const hMatch = errorMessage.match(/(\d+)\s*h(?:ours?)?/i);
  const mMatch = errorMessage.match(/(\d+)\s*m(?:in(?:utes?)?)?/i);
  const sMatch = errorMessage.match(/(\d+(?:\.\d+)?)\s*s(?:ec(?:onds?)?)?/i);

  let totalMs = 0;
  if (hMatch) totalMs += parseInt(hMatch[1], 10) * 3600000;
  if (mMatch) totalMs += parseInt(mMatch[1], 10) * 60000;
  if (sMatch) totalMs += Math.ceil(parseFloat(sMatch[1]) * 1000);

  if (totalMs >= 1000) return totalMs;

  // Fallback padrão se não houver tempo explícito
  return 60000; // 1 minuto
}

// Pool de API Keys
async function getActiveApiKey(excludeIds = []) {
  const data = await chrome.storage.local.get(['geminiKeys']);
  const keys = data.geminiKeys || [];

  if (!keys.length) return null;

  const now = Date.now();
  const availableKeys = keys.filter(k => {
    if (!k.active) return false;
    if (excludeIds.includes(k.id)) return false;
    if (k.status === 'rate_limited' && k.rateLimitReset && k.rateLimitReset > now) return false;
    return true;
  });

  if (!availableKeys.length) {
    const next = keys
      .filter(k => k.active && k.rateLimitReset && k.rateLimitReset > now)
      .sort((a, b) => (a.rateLimitReset || 0) - (b.rateLimitReset || 0))[0];
    if (next) {
      const resetTime = new Date(next.rateLimitReset).toLocaleTimeString('pt-BR');
      throw new Error(`Limite da API atingido em todas as chaves do pool. Tente novamente após ${resetTime}.`);
    }
    throw new Error('Nenhuma chave de API disponível no momento.');
  }

  return availableKeys.sort((a, b) => (a.usageCount || 0) - (b.usageCount || 0))[0];
}

async function incrementKeyUsage(keyId) {
  const data = await chrome.storage.local.get(['geminiKeys']);
  const keys = data.geminiKeys || [];
  const key = keys.find(k => k.id === keyId);
  if (key) {
    key.usageCount = (key.usageCount || 0) + 1;
    key.lastUsed = Date.now();
    await chrome.storage.local.set({ geminiKeys: keys });
  }
}

async function markKeyAsLimited(keyId, until) {
  const data = await chrome.storage.local.get(['geminiKeys']);
  const keys = data.geminiKeys || [];
  const key = keys.find(k => k.id === keyId);
  if (key) {
    key.status = 'rate_limited';
    key.rateLimitReset = until;
    await chrome.storage.local.set({ geminiKeys: keys });
  }
}

function sanitizeModel(model) {
  const value = String(model || DEFAULT_MODEL).trim();
  if (!/^[a-zA-Z0-9._:-]+$/.test(value)) return DEFAULT_MODEL;
  return value;
}

// The Models API exposes supported methods, but not a direct "audio input" flag.
// Keep this allowlist aligned with Google's documented multimodal/audio-input families.
function isAudioInputModel(name) {
  const id = name.replace(/^models\//, '');
  if (id === TRANSCRIBE_MODEL) return true;
  if (/(live|tts|image|embedding|imagen|veo|lyria)/i.test(id)) return false;
  return /^(gemini-(3\.8|3\.7|3\.6|3\.5|3\.1|3|2\.5)-(flash(?:-lite)?|pro)(?:-.+)?)$/i.test(id);
}

async function listAudioModels(apiKey) {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
    headers: { 'x-goog-api-key': apiKey }
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error?.message || `Falha ao listar modelos (HTTP ${response.status}).`);

  const models = (json.models || [])
    .filter(model => isAudioInputModel(model.name))
    .filter(model => (model.supportedGenerationMethods || []).includes('generateContent') || model.name.endsWith(TRANSCRIBE_MODEL))
    .map(model => ({
      id: model.name.replace(/^models\//, ''),
      name: model.displayName || model.name.replace(/^models\//, ''),
      description: model.description || '',
      transcribe: model.name.replace(/^models\//, '') === TRANSCRIBE_MODEL
    }));

  // The dedicated transcriber uses the Interactions API and may not advertise
  // generateContent in models.list, so keep it available when the API exposes it.
  const transcribe = models.find(m => m.id === TRANSCRIBE_MODEL);
  if (!transcribe) {
    const raw = (json.models || []).find(m => m.name?.replace(/^models\//, '') === TRANSCRIBE_MODEL);
    if (raw) models.push({
      id: TRANSCRIBE_MODEL,
      name: raw.displayName || 'Gemini 3.5 Transcribe',
      description: raw.description || 'Transcrição dedicada de voz para texto.',
      transcribe: true
    });
  }

  return models.sort((a, b) => {
    if (a.transcribe !== b.transcribe) return a.transcribe ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function urlToDataUrl(url) {
  if (!url) throw new Error('URL do áudio não encontrada.');
  if (url.startsWith('blob:')) throw new Error('O áudio ainda está como blob. Reproduza-o uma vez e tente novamente.');

  const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
  if (!response.ok) throw new Error(`Falha ao baixar o áudio (${response.status}).`);
  return await blobToDataUrl(await response.blob());
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Não foi possível converter o áudio.'));
    reader.readAsDataURL(blob);
  });
}

// Backoff exponencial para erros transitórios (429/408/5xx) — recomendado
// pela documentação do Gemini: "This model is currently experiencing high demand"
async function postJsonWithRetry(url, options) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, options);
    const json = await response.json().catch(() => ({}));
    const transient = !response.ok &&
      (response.status === 408 || response.status === 429 || response.status >= 500);
    if (!transient || attempt >= 2) return { ok: response.ok, status: response.status, json };
    await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
  }
}

async function transcribeWithGemini(dataUrl, apiKey, model) {
  // Matches data URLs with optional parameters (e.g. "audio/ogg; codecs=opus")
  const match = /^data:([^;,]+)[^,]*;base64,(.+)$/s.exec(dataUrl);
  const mimeType = match?.[1] || 'audio/ogg';
  const data = match?.[2] || dataUrl;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const { ok, status, json } = await postJsonWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: 'Transcreva este áudio do WhatsApp. Preserve o idioma falado. Retorne somente a transcrição, sem comentários, introdução ou explicação.' },
          { inlineData: { mimeType, data } }
        ]
      }]
    })
  });

  if (!ok) throw new Error(json?.error?.message || `Gemini retornou HTTP ${status}.`);
  const text = json?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('').trim();
  if (!text) throw new Error('O Gemini não retornou uma transcrição.');
  return text;
}

async function transcribeWithDedicatedModel(dataUrl, apiKey) {
  // Matches data URLs with optional parameters (e.g. "audio/ogg; codecs=opus")
  const match = /^data:([^;,]+)[^,]*;base64,(.+)$/s.exec(dataUrl);
  const mimeType = match?.[1] || 'audio/ogg';
  const base64 = match?.[2] || dataUrl;
  const bytes = base64ToUint8Array(base64);

  const file = await uploadAudioFile(bytes, mimeType, apiKey);
  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/interactions';
    const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
    const input = [{ type: 'audio', uri: file.uri, mime_type: mimeType }];

    // O doc diz que modo 'smart' exige um campo de thinking dentro de
    // transcription_config, mas a API rejeita both thinkingLevel e thinking_level
    // ("Unknown parameter"). Como smart não pode ser satisfeito hoje, fazemos
    // fallback automático para o modo padrão (sem transcription_config) que,
    // por definição, transcreve o áudio — garantindo que a transcrição funcione.
    // smartUnsupported é volátil por ciclo de vida do service worker: uma única
    // falha em 'smart' já grava a decisão e evita requests redundantes depois.
    const send = (cfg) => postJsonWithRetry(url, {
      method: 'POST', headers,
      body: JSON.stringify({ model: TRANSCRIBE_MODEL, input, ...cfg })
    });

    let result = smartUnsupported
      ? await send({})  // smart falhou antes nesta sessão → pula direto pro padrão
      : await send({ generation_config: { transcription_config: { mode: 'smart', thinkingLevel: 'minimal' } } });

    // Erros relacionados a thinking/thinkingLevel → smart indisponível agora,
    // registra e renova a tentativa no modo padrão (que sempre funciona)
    if (!result.ok && /thinking|Unknown (?:name|parameter)/i.test(result.json?.error?.message || '')) {
      smartUnsupported = true;
      result = await send({});
    }

    if (!result.ok) throw new Error(result.json?.error?.message || `Gemini Transcribe retornou HTTP ${result.status}.`);
    const text = result.json?.output_text || extractInteractionText(result.json);
    if (!text) throw new Error('O Gemini Transcribe não retornou uma transcrição.');
    return text.trim();
  } finally {
    if (file.name) {
      fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}`, {
        method: 'DELETE',
        headers: { 'x-goog-api-key': apiKey }
      }).catch(() => {});
    }
  }
}

function extractInteractionText(json) {
  const steps = Array.isArray(json?.steps) ? json.steps : [];
  return steps.flatMap(step => Array.isArray(step?.content) ? step.content : [])
    .filter(part => part?.type === 'text')
    .map(part => part.text || '')
    .join('');
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function uploadAudioFile(bytes, mimeType, apiKey) {
  const start = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ file: { display_name: `whatsapp-audio-${Date.now()}` } })
  });

  if (!start.ok) {
    const json = await start.json().catch(() => ({}));
    throw new Error(json?.error?.message || `Falha ao iniciar upload (HTTP ${start.status}).`);
  }

  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('O Google não retornou a URL de upload.');

  const upload = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(bytes.byteLength),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize'
    },
    body: bytes
  });

  const json = await upload.json().catch(() => ({}));
  if (!upload.ok) throw new Error(json?.error?.message || `Falha no upload (HTTP ${upload.status}).`);
  if (!json?.file?.uri) throw new Error('O Google não retornou o URI do arquivo.');
  return json.file;
}
