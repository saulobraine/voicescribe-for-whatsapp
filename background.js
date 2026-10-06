const DEFAULT_MODEL = 'gemini-3.8-flash';
const TRANSCRIBE_MODEL = 'gemini-3.5-transcribe';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === 'listAudioModels') {
    (async () => {
      try {
        const { geminiKey } = await chrome.storage.local.get(['geminiKey']);
        if (!geminiKey) throw new Error('Configure sua chave Gemini primeiro.');
        const models = await listAudioModels(geminiKey);
        sendResponse({ success: true, models });
      } catch (error) {
        sendResponse({ success: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  if (message?.action !== 'transcribeAudio') return;

  (async () => {
    try {
      const { geminiKey, selectedModel = DEFAULT_MODEL } = await chrome.storage.local.get([
        'geminiKey',
        'selectedModel'
      ]);

      if (!geminiKey) throw new Error('Configure sua chave Gemini no popup da extensão.');

      const model = sanitizeModel(selectedModel);
      const dataUrl = message.audioData || await urlToDataUrl(message.audioUrl);
      const transcript = model === TRANSCRIBE_MODEL
        ? await transcribeWithDedicatedModel(dataUrl, geminiKey)
        : await transcribeWithGemini(dataUrl, geminiKey, model);

      sendResponse({ success: true, data: transcript });
    } catch (error) {
      console.error('[WGT] Transcription error:', error);
      sendResponse({ success: false, error: error?.message || String(error) });
    }
  })();

  return true;
});

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

async function transcribeWithGemini(dataUrl, apiKey, model) {
  // Matches data URLs with optional parameters (e.g. "audio/ogg; codecs=opus")
  const match = /^data:([^;,]+)[^,]*;base64,(.+)$/s.exec(dataUrl);
  const mimeType = match?.[1] || 'audio/ogg';
  const data = match?.[2] || dataUrl;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(url, {
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

  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error?.message || `Gemini retornou HTTP ${response.status}.`);
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
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        model: TRANSCRIBE_MODEL,
        input: [{ type: 'audio', uri: file.uri, mime_type: mimeType }],
        generation_config: { transcription_config: { mode: 'smart' } }
      })
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json?.error?.message || `Gemini Transcribe retornou HTTP ${response.status}.`);
    const text = json?.output_text || extractInteractionText(json);
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
