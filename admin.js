// ===== Pool de API Keys - Interface de Administração =====

const STORAGE_KEY = 'geminiKeys';
const DEFAULT_KEY = 'geminiKey'; // Chave única legada

function init() {
  loadKeys();

  document.getElementById('add-key-btn')?.addEventListener('click', addKey);

  // Escuta alterações no storage para atualizar a interface em tempo real
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]) {
      renderKeys(changes[STORAGE_KEY].newValue || []);
    }
  });

  // Atualiza apenas os contadores de cooldown a cada 1 segundo (sem destruir o DOM)
  setInterval(updateCooldownDisplay, 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ===== Carregar chaves =====
async function loadKeys() {
  try {
    const data = await chrome.storage.local.get([STORAGE_KEY, DEFAULT_KEY]);
    let keys = data[STORAGE_KEY] || [];

    // Migração: se existir apenas uma chave única, converte para pool
    if (!keys.length && data[DEFAULT_KEY]) {
      keys = [{
        id: generateId(),
        key: data[DEFAULT_KEY],
        active: true,
        status: 'available',
        rateLimitReset: null,
        usageCount: 0,
        lastUsed: Date.now()
      }];
      await saveKeysToStorage(keys);
    }

    renderKeys(keys);
  } catch (error) {
    console.error('[WGT Admin] Erro ao carregar chaves:', error);
    showBanner('Erro ao carregar chaves: ' + (error?.message || error), true);
  }
}

// ===== Renderizar chaves na tabela =====
function renderKeys(keys) {
  const tbody = document.getElementById('keys-table');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!keys.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#667781;padding:16px">Nenhuma chave configurada. Clique em <strong>➕ Adicionar Nova Chave</strong> acima.</td></tr>';
    return;
  }

  keys.forEach(key => {
    const row = document.createElement('tr');
    row.dataset.keyId = key.id;
    row.dataset.rateLimitReset = key.rateLimitReset || '';

    const isLimited = key.status === 'rate_limited' && key.rateLimitReset && key.rateLimitReset > Date.now();
    const statusClass = isLimited ? 'status-limited' : 'status-available';
    const statusText = isLimited ? '🕐 Em cooldown' : '✅ Disponível';

    const cooldownText = formatCooldown(key.rateLimitReset);

    // Oculta o meio da chave para privacidade
    const keyDisplay = key.key.length > 14
      ? `${key.key.substring(0, 8)}••••${key.key.substring(key.key.length - 4)}`
      : '••••••••';

    const keyId = key.id;

    const toggleBtn = document.createElement('button');
    toggleBtn.className = `toggle ${key.active ? 'active' : 'inactive'}`;
    toggleBtn.title = key.active ? 'Desativar chave' : 'Ativar chave';
    toggleBtn.addEventListener('click', () => toggleKey(keyId));

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-danger';
    removeBtn.style.cssText = 'font-size:12px;padding:4px 8px';
    removeBtn.textContent = '🗑️';
    removeBtn.title = 'Remover chave';
    removeBtn.addEventListener('click', () => removeKey(keyId));

    row.innerHTML = `
      <td><code style="font-family:monospace;font-size:12px">${keyDisplay}</code></td>
      <td class="status-cell ${statusClass}">${statusText}</td>
      <td class="cooldown-cell">${cooldownText}</td>
      <td>${key.usageCount || 0}</td>
      <td class="toggle-cell"></td>
      <td class="action-cell"></td>
    `;

    row.querySelector('.toggle-cell').appendChild(toggleBtn);
    row.querySelector('.action-cell').appendChild(removeBtn);

    tbody.appendChild(row);
  });
}

// ===== Atualização suave apenas dos contadores de cooldown =====
function updateCooldownDisplay() {
  const rows = document.querySelectorAll('#keys-table tr[data-rate-limit-reset]');
  const now = Date.now();

  rows.forEach(row => {
    const resetTime = parseInt(row.dataset.rateLimitReset, 10);
    const cooldownCell = row.querySelector('.cooldown-cell');
    const statusCell = row.querySelector('.status-cell');

    if (!resetTime || isNaN(resetTime)) {
      if (cooldownCell) cooldownCell.textContent = '-';
      return;
    }

    if (resetTime > now) {
      if (cooldownCell) cooldownCell.textContent = formatCooldown(resetTime);
      if (statusCell && !statusCell.classList.contains('status-limited')) {
        statusCell.className = 'status-cell status-limited';
        statusCell.textContent = '🕐 Em cooldown';
      }
    } else {
      // Cooldown expirou
      row.dataset.rateLimitReset = '';
      if (cooldownCell) cooldownCell.textContent = '-';
      if (statusCell && statusCell.classList.contains('status-limited')) {
        statusCell.className = 'status-cell status-available';
        statusCell.textContent = '✅ Disponível';
      }
    }
  });
}

function formatCooldown(resetTime) {
  if (!resetTime || resetTime <= Date.now()) return '-';
  const remaining = Math.max(0, Math.floor((resetTime - Date.now()) / 1000));
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ===== Adicionar nova chave =====
async function addKey() {
  const key = prompt('Insira a chave da API do Gemini (AIza...):');
  if (!key || !key.trim()) return;

  const trimmed = key.trim();
  const keys = await loadKeysFromStorage();

  if (keys.some(k => k.key === trimmed)) {
    showBanner('Esta chave já está presente no pool.', true);
    return;
  }

  keys.push({
    id: generateId(),
    key: trimmed,
    active: true,
    status: 'available',
    rateLimitReset: null,
    usageCount: 0,
    lastUsed: 0
  });

  await saveKeysToStorage(keys);
  showBanner('Chave adicionada com sucesso!', false);
  loadKeys();
}

// ===== Remover chave =====
async function removeKey(id) {
  if (!confirm('Deseja realmente remover esta chave do pool?')) return;

  const keys = await loadKeysFromStorage();
  const updated = keys.filter(k => k.id !== id);
  await saveKeysToStorage(updated);
  showBanner('Chave removida.', false);
  loadKeys();
}

// ===== Alternar status ativo/inativo =====
async function toggleKey(id) {
  const keys = await loadKeysFromStorage();
  const key = keys.find(k => k.id === id);
  if (key) {
    key.active = !key.active;
    await saveKeysToStorage(keys);
    loadKeys();
  }
}

// ===== Funções auxiliares =====
async function loadKeysFromStorage() {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  return data[STORAGE_KEY] || [];
}

async function saveKeysToStorage(keys) {
  await chrome.storage.local.set({ [STORAGE_KEY]: keys });
}

function generateId() {
  return 'wgt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 11);
}

function showBanner(message, isError) {
  const banner = document.getElementById('status-banner');
  if (!banner) return;
  banner.textContent = message;
  banner.className = `status-banner ${isError ? 'err' : 'ok'}`;
  setTimeout(() => {
    if (banner.textContent === message) {
      banner.style.display = 'none';
      banner.className = 'status-banner';
    }
  }, 3500);
}