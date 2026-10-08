const DEFAULT_MODEL = 'gemini-3.8-flash';
const modelSelect = document.getElementById('model');
const statusEl = document.getElementById('status');

(async () => {
  // Migração: converte chave única para pool se necessário
  const data = await chrome.storage.local.get(['geminiKey', 'geminiKeys']);
  if (!data.geminiKeys?.length && data.geminiKey) {
    const pool = [{
      id: 'wgt_' + Date.now().toString(36),
      key: data.geminiKey,
      active: true,
      status: 'available',
      rateLimitReset: null,
      usageCount: 0,
      lastUsed: 0
    }];
    await chrome.storage.local.set({ geminiKeys: pool });
    console.log('[WGT] Migrado chave única para pool');
  }

  const { selectedModel = DEFAULT_MODEL } = await chrome.storage.local.get('selectedModel');
  await loadModels(selectedModel, false);
})();

document.getElementById('refresh').addEventListener('click', async () => {
  await loadModels(modelSelect.value || DEFAULT_MODEL, true);
});

document.getElementById('save').addEventListener('click', async () => {
  const selectedModel = modelSelect.value.trim() || DEFAULT_MODEL;
  await chrome.storage.local.set({ selectedModel });
  setStatus('Configuração salva.', false);
});

document.getElementById('test').addEventListener('click', async () => {
  const selectedModel = modelSelect.value.trim() || DEFAULT_MODEL;
  const { geminiKeys } = await chrome.storage.local.get('geminiKeys');
  const apiKey = geminiKeys?.find(k => k.active && (!k.rateLimitReset || k.rateLimitReset < Date.now()))?.key;
  if (!apiKey) return setStatus('Nenhuma chave ativa. Adicione em Gerenciar API Keys.', true);

  setStatus('Testando modelo...', false);
  try {
    if (selectedModel === 'gemini-3.5-transcribe') {
      // Validate that the model is available to the key without sending audio.
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}`, {
        headers: { 'x-goog-api-key': apiKey }
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error?.message || `HTTP ${response.status}`);
    } else {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Responda apenas: OK' }] }] })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error?.message || `HTTP ${response.status}`);
    }
    setStatus('Chave e modelo estão disponíveis.', false);
  } catch (error) {
    setStatus(error.message, true);
  }
});

async function loadModels(selectedModel, showStatus) {
  if (showStatus) setStatus('Buscando modelos com áudio...', false);
  modelSelect.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ action: 'listAudioModels' });
    if (!response?.success) throw new Error(response?.error || 'Não foi possível listar os modelos.');
    populateModels(response.models || [], selectedModel);
    if (showStatus) setStatus(`${response.models.length} modelo(s) de áudio encontrado(s).`, false);
  } catch (error) {
    const isNoKeys = error.message.includes('painel') || error.message.includes('chaves');
    modelSelect.innerHTML = isNoKeys
      ? '<option>Configure suas chaves no painel</option>'
      : '<option>Falha ao carregar modelos</option>';
    setStatus(error.message, true);
  } finally {
    modelSelect.disabled = false;
  }
}

function populateModels(models, selectedModel) {
  modelSelect.innerHTML = '';
  if (!models.length) {
    modelSelect.innerHTML = '<option value="">Nenhum modelo compatível encontrado</option>';
    return;
  }

  const dedicated = models.filter(item => item.transcribe);
  const general = models.filter(item => !item.transcribe);

  if (dedicated.length) {
    const group = document.createElement('optgroup');
    group.label = 'Transcrição dedicada';
    dedicated.forEach(item => addOption(group, item));
    modelSelect.appendChild(group);
  }

  if (general.length) {
    const group = document.createElement('optgroup');
    group.label = 'Gemini multimodal';
    general.forEach(item => addOption(group, item));
    modelSelect.appendChild(group);
  }

  const exists = models.some(item => item.id === selectedModel);
  modelSelect.value = exists ? selectedModel : (dedicated[0]?.id || general[0]?.id || DEFAULT_MODEL);
}

function addOption(parent, item) {
  const option = document.createElement('option');
  option.value = item.id;
  option.textContent = item.name;
  option.title = item.description || item.id;
  parent.appendChild(option);
}

function setStatus(message, error) {
  statusEl.textContent = message;
  statusEl.className = `status ${error ? 'err' : 'ok'}`;
}

// Botão de limpar cache
const clearBtn = document.getElementById('clear-cache');
if (clearBtn) {
  clearBtn.addEventListener('click', async () => {
    if (!confirm('Tem certeza que deseja zerar todo o cache de áudio transcrito?')) return;

    clearBtn.disabled = true;
    clearBtn.textContent = '⏳ Limpando...';

    try {
      const all = await chrome.storage.local.get(null);

      // Remove todas as chaves de cache de mensagens e quotas
      const cacheKeys = Object.keys(all).filter(key =>
        key.startsWith('wgt_msg_cache_') ||
        key.startsWith('wgt_cache_') ||
        key.startsWith('wgt_quota_cooldown')
      );

      if (cacheKeys.length > 0) {
        await chrome.storage.local.remove(cacheKeys);
      }

      setStatus(`Cache zerado: ${cacheKeys.length} entradas removidas.`, false);
      setTimeout(() => { clearBtn.textContent = 'Zerar Cachê'; }, 1500);
    } catch (err) {
      setStatus('Erro ao limpar cache: ' + (err?.message || err), true);
      setTimeout(() => { clearBtn.textContent = 'Zerar Cachê'; }, 2000);
    } finally {
      clearBtn.disabled = false;
    }
  });
}
