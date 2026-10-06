const DEFAULT_MODEL = 'gemini-3.8-flash';
const key = document.getElementById('key');
const model = document.getElementById('model');
const status = document.getElementById('status');

chrome.storage.local.get(['geminiKey', 'selectedModel'], async values => {
  key.value = values.geminiKey || '';
  await loadModels(values.geminiKey || '', values.selectedModel || DEFAULT_MODEL, false);
});

document.getElementById('refresh').addEventListener('click', async () => {
  await loadModels(key.value.trim(), model.value || DEFAULT_MODEL, true);
});

document.getElementById('save').addEventListener('click', async () => {
  const selectedModel = model.value.trim() || DEFAULT_MODEL;
  await chrome.storage.local.set({ geminiKey: key.value.trim(), selectedModel });
  setStatus('Configuração salva.', false);
});

document.getElementById('test').addEventListener('click', async () => {
  const apiKey = key.value.trim();
  const selectedModel = model.value.trim() || DEFAULT_MODEL;
  if (!apiKey) return setStatus('Informe a chave primeiro.', true);

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

async function loadModels(apiKey, selectedModel, showStatus) {
  if (!apiKey) {
    model.disabled = true;
    model.innerHTML = '<option>Informe a chave e clique em Atualizar</option>';
    return;
  }

  if (showStatus) setStatus('Buscando modelos com áudio...', false);
  model.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ action: 'listAudioModels' });
    if (!response?.success) throw new Error(response?.error || 'Não foi possível listar os modelos.');
    populateModels(response.models || [], selectedModel);
    if (showStatus) setStatus(`${response.models.length} modelo(s) de áudio encontrado(s).`, false);
  } catch (error) {
    model.innerHTML = '<option>Falha ao carregar modelos</option>';
    setStatus(error.message, true);
  } finally {
    model.disabled = false;
  }
}

function populateModels(models, selectedModel) {
  model.innerHTML = '';
  if (!models.length) {
    model.innerHTML = '<option value="">Nenhum modelo compatível encontrado</option>';
    return;
  }

  const dedicated = models.filter(item => item.transcribe);
  const general = models.filter(item => !item.transcribe);

  if (dedicated.length) {
    const group = document.createElement('optgroup');
    group.label = 'Transcrição dedicada';
    dedicated.forEach(item => addOption(group, item));
    model.appendChild(group);
  }

  if (general.length) {
    const group = document.createElement('optgroup');
    group.label = 'Gemini multimodal';
    general.forEach(item => addOption(group, item));
    model.appendChild(group);
  }

  const exists = models.some(item => item.id === selectedModel);
  model.value = exists ? selectedModel : (dedicated[0]?.id || general[0]?.id || DEFAULT_MODEL);
}

function addOption(parent, item) {
  const option = document.createElement('option');
  option.value = item.id;
  option.textContent = item.name;
  option.title = item.description || item.id;
  parent.appendChild(option);
}

function setStatus(message, error) {
  status.textContent = message;
  status.className = `status ${error ? 'err' : 'ok'}`;
}
