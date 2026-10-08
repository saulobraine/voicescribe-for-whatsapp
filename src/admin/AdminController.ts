import { ChromeStorageGateway, StoredApiKeyRecord } from '../infrastructure/ChromeStorageGateway.js';
import { ApiKeyPool } from '../domain/ApiKeyPool.js';

export class AdminController {
  private readonly storage: ChromeStorageGateway;

  constructor(storage: ChromeStorageGateway = new ChromeStorageGateway()) {
    this.storage = storage;
  }

  public async initialize(): Promise<void> {
    this.bindEvents();
    await this.refreshTable();
    this.startCooldownTimer();
    this.listenStorageChanges();
  }

  private bindEvents(): void {
    this.bindPanelToggleEvents();
    this.bindPanelActionEvents();
    this.bindInputKeyboardEvents();
    this.bindToolbarEvents();
  }

  private bindToolbarEvents(): void {
    const refreshBtn = document.getElementById('refresh-keys-btn');
    refreshBtn?.addEventListener('click', () => void this.handleManualRefresh());
  }

  private async handleManualRefresh(): Promise<void> {
    const refreshBtn = document.getElementById('refresh-keys-btn') as HTMLButtonElement | null;
    const icon = refreshBtn?.querySelector('.refresh-icon') as HTMLElement | null;

    if (refreshBtn) {
      refreshBtn.disabled = true;
    }
    if (icon) {
      icon.classList.add('spinning');
    }

    try {
      await this.refreshTable();
      this.showBanner('Tabela e status das chaves atualizados com sucesso.', false);
    } catch {
      this.showBanner('Erro ao atualizar a lista de chaves.', true);
    } finally {
      setTimeout(() => {
        if (refreshBtn) {
          refreshBtn.disabled = false;
        }
        if (icon) {
          icon.classList.remove('spinning');
        }
      }, 450);
    }
  }

  private bindPanelToggleEvents(): void {
    const toggleBtn = document.getElementById('toggle-add-panel-btn');
    const cancelBtn = document.getElementById('cancel-panel-btn');
    const closeBtn = document.getElementById('close-panel-btn');

    toggleBtn?.addEventListener('click', () => this.toggleAddPanel());
    cancelBtn?.addEventListener('click', () => this.closeAddPanel());
    closeBtn?.addEventListener('click', () => this.closeAddPanel());
  }

  private bindPanelActionEvents(): void {
    const pasteBtn = document.getElementById('paste-key-btn');
    const visibilityBtn = document.getElementById('toggle-visibility-btn');
    const submitBtn = document.getElementById('submit-new-key-btn');
    const testBtn = document.getElementById('test-new-key-btn');

    pasteBtn?.addEventListener('click', () => void this.pasteFromClipboard());
    visibilityBtn?.addEventListener('click', () => this.toggleKeyInputVisibility());
    submitBtn?.addEventListener('click', () => void this.submitNewKeyFromInput());
    testBtn?.addEventListener('click', () => void this.testDraftKey());
  }

  private bindInputKeyboardEvents(): void {
    const input = document.getElementById('new-key-input') as HTMLInputElement | null;
    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void this.submitNewKeyFromInput();
        return;
      }
      if (event.key === 'Escape') {
        this.closeAddPanel();
      }
    });
  }

  private toggleAddPanel(): void {
    const panel = document.getElementById('add-key-panel');
    const isCollapsed = panel?.classList.contains('collapsed');
    if (isCollapsed) {
      this.openAddPanel();
      return;
    }
    this.closeAddPanel();
  }

  private openAddPanel(): void {
    const panel = document.getElementById('add-key-panel');
    const input = document.getElementById('new-key-input') as HTMLInputElement | null;
    panel?.classList.remove('collapsed');
    input?.focus();
  }

  private closeAddPanel(): void {
    const panel = document.getElementById('add-key-panel');
    const input = document.getElementById('new-key-input') as HTMLInputElement | null;
    panel?.classList.add('collapsed');
    if (input) {
      input.value = '';
    }
  }

  private async pasteFromClipboard(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      const input = document.getElementById('new-key-input') as HTMLInputElement | null;
      if (input && text.trim().length > 0) {
        input.value = text.trim();
        input.focus();
      }
    } catch {
      this.showBanner('Não foi possível acessar a área de transferência.', true);
    }
  }

  private toggleKeyInputVisibility(): void {
    const input = document.getElementById('new-key-input') as HTMLInputElement | null;
    const btn = document.getElementById('toggle-visibility-btn');
    if (!input || !btn) {
      return;
    }
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.textContent = isPassword ? '🔒' : '👁️';
  }

  private async submitNewKeyFromInput(): Promise<void> {
    const input = document.getElementById('new-key-input') as HTMLInputElement | null;
    const rawKey = input?.value.trim() || '';

    if (rawKey.length === 0) {
      this.showBanner('Por favor, informe uma chave de API válida.', true);
      input?.focus();
      return;
    }

    try {
      const records = await this.storage.getStoredKeys();
      const pool = new ApiKeyPool(records);
      const updatedPool = pool.addKey(rawKey);
      await this.storage.saveStoredKeys([...updatedPool.getAll()]);
      this.closeAddPanel();
      this.showBanner('Chave de API adicionada ao pool com sucesso!', false);
      await this.refreshTable();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.showBanner(message, true);
    }
  }

  private async testDraftKey(): Promise<void> {
    const input = document.getElementById('new-key-input') as HTMLInputElement | null;
    const rawKey = input?.value.trim() || '';

    if (rawKey.length === 0) {
      this.showBanner('Insira a chave no campo antes de testar.', true);
      input?.focus();
      return;
    }

    this.showBanner('Testando chave com a API do Gemini...', false);
    const isValid = await this.verifyKeyConnectivity(rawKey);
    if (isValid) {
      this.showBanner('✅ Chave válida e com acesso à API Gemini!', false);
      return;
    }
    this.showBanner('❌ A chave informada é inválida ou foi rejeitada pela Google.', true);
  }

  private async verifyKeyConnectivity(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
        headers: { 'x-goog-api-key': apiKey },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private listenStorageChanges(): void {
    chrome.storage?.onChanged?.addListener((changes, area) => {
      if (area === 'local' && changes.geminiKeys) {
        this.renderKeys(changes.geminiKeys.newValue || []);
      }
    });
  }

  private startCooldownTimer(): void {
    setInterval(() => this.updateCooldownDisplay(), 1000);
  }

  private async refreshTable(): Promise<void> {
    const records = await this.storage.getStoredKeys();
    this.renderKeys(records);
  }

  private renderKeys(records: StoredApiKeyRecord[]): void {
    this.updateStatsBar(records);
    const tbody = document.getElementById('keys-table');
    if (!tbody) {
      return;
    }
    tbody.innerHTML = '';

    if (records.length === 0) {
      this.renderEmptyState(tbody);
      return;
    }

    records.forEach((record, index) => {
      const row = this.createTableRow(record, index + 1);
      tbody.appendChild(row);
    });
  }

  private updateStatsBar(records: StoredApiKeyRecord[]): void {
    const totalEl = document.getElementById('stat-total');
    const activeEl = document.getElementById('stat-active');
    const cooldownEl = document.getElementById('stat-cooldown');
    const usagesEl = document.getElementById('stat-usages');

    const total = records.length;
    const active = records.filter((r) => r.active).length;
    const cooldown = records.filter((r) => r.status === 'rate_limited' && Boolean(r.rateLimitReset && r.rateLimitReset > Date.now())).length;
    const usages = records.reduce((sum, r) => sum + (r.usageCount || 0), 0);

    if (totalEl) totalEl.textContent = String(total);
    if (activeEl) activeEl.textContent = String(active);
    if (cooldownEl) cooldownEl.textContent = String(cooldown);
    if (usagesEl) usagesEl.textContent = String(usages);
  }

  private renderEmptyState(tbody: HTMLElement): void {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td colspan="7">
        <div class="empty-state">
          <div class="empty-state-icon">🗝️</div>
          <h3>Nenhuma chave de API cadastrada</h3>
          <p style="margin:0 0 16px;font-size:12.5px;">Adicione uma ou mais chaves do Gemini para iniciar a transcrição de áudios.</p>
          <button type="button" id="empty-state-add-btn" class="btn btn-add">➕ Cadastrar Primeira Chave</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);

    row.querySelector('#empty-state-add-btn')?.addEventListener('click', () => {
      this.openAddPanel();
    });
  }

  private createTableRow(record: StoredApiKeyRecord, index: number): HTMLTableRowElement {
    const row = document.createElement('tr');
    row.dataset.keyId = record.id;
    row.dataset.rateLimitReset = String(record.rateLimitReset || '');

    const isLimited = record.status === 'rate_limited' && Boolean(record.rateLimitReset && record.rateLimitReset > Date.now());
    const badgeClass = !record.active ? 'inactive' : isLimited ? 'limited' : 'available';
    const statusText = !record.active ? 'Inativa' : isLimited ? 'Em cooldown' : 'Disponível';
    const cooldownText = this.formatCooldown(record.rateLimitReset);
    const maskedKey = this.maskKey(record.key);

    row.innerHTML = `
      <td class="col-index">${index}</td>
      <td>
        <div class="key-display">
          <code>${maskedKey}</code>
          <button type="button" class="btn-copy-key" title="Copiar chave completa">📋</button>
        </div>
      </td>
      <td>
        <span class="status-badge ${badgeClass}">
          <span class="status-dot"></span>
          <span class="status-text">${statusText}</span>
        </span>
      </td>
      <td class="cooldown-cell">${cooldownText}</td>
      <td><span class="usage-badge">${record.usageCount || 0}</span></td>
      <td class="toggle-cell"></td>
      <td class="action-cell">
        <div class="actions-group"></div>
      </td>
    `;

    this.attachRowEvents(row, record);
    return row;
  }

  private attachRowEvents(row: HTMLTableRowElement, record: StoredApiKeyRecord): void {
    const copyBtn = row.querySelector('.btn-copy-key');
    copyBtn?.addEventListener('click', () => void this.copyKeyToClipboard(record.key, copyBtn as HTMLButtonElement));

    const toggleBtn = this.createToggleButton(record);
    row.querySelector('.toggle-cell')?.appendChild(toggleBtn);

    const testBtn = this.createTestButton(record.key);
    const removeBtn = this.createRemoveButton(record.id);
    const actionsGroup = row.querySelector('.actions-group');
    actionsGroup?.appendChild(testBtn);
    actionsGroup?.appendChild(removeBtn);
  }

  private async copyKeyToClipboard(key: string, button: HTMLButtonElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(key);
      const originalText = button.textContent;
      button.textContent = '✓';
      setTimeout(() => {
        if (button.isConnected) {
          button.textContent = originalText;
        }
      }, 1200);
    } catch {
      this.showBanner('Erro ao copiar chave.', true);
    }
  }

  private maskKey(rawKey: string): string {
    if (rawKey.length <= 14) {
      return '••••••••';
    }
    const start = rawKey.substring(0, 8);
    const end = rawKey.substring(rawKey.length - 4);
    return `${start}••••${end}`;
  }

  private createToggleButton(record: StoredApiKeyRecord): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = `toggle ${record.active ? 'active' : 'inactive'}`;
    button.title = record.active ? 'Desativar chave' : 'Ativar chave';
    button.addEventListener('click', () => {
      void this.toggleKey(record.id);
    });
    return button;
  }

  private createTestButton(key: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'btn btn-test-action';
    button.textContent = '🧪 Testar';
    button.title = 'Testar se esta chave está funcionando';
    button.addEventListener('click', async () => {
      button.textContent = '⏳';
      const isValid = await this.verifyKeyConnectivity(key);
      button.textContent = isValid ? '✅ OK' : '❌ Falha';
      setTimeout(() => {
        if (button.isConnected) {
          button.textContent = '🧪 Testar';
        }
      }, 2000);
    });
    return button;
  }

  private createRemoveButton(keyId: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'btn btn-danger';
    button.textContent = '🗑️';
    button.title = 'Remover chave do pool';
    button.addEventListener('click', () => {
      void this.removeKey(keyId);
    });
    return button;
  }

  private async toggleKey(keyId: string): Promise<void> {
    const records = await this.storage.getStoredKeys();
    const pool = new ApiKeyPool(records);
    const updated = pool.toggleKey(keyId);
    await this.storage.saveStoredKeys([...updated.getAll()]);
    await this.refreshTable();
  }

  private async removeKey(keyId: string): Promise<void> {
    if (!confirm('Deseja realmente remover esta chave do pool?')) {
      return;
    }
    const records = await this.storage.getStoredKeys();
    const pool = new ApiKeyPool(records);
    const updated = pool.removeKey(keyId);
    await this.storage.saveStoredKeys([...updated.getAll()]);
    this.showBanner('Chave removida.', false);
    await this.refreshTable();
  }

  private updateCooldownDisplay(): void {
    const rows = document.querySelectorAll<HTMLElement>('#keys-table tr[data-rate-limit-reset]');
    const now = Date.now();

    rows.forEach((row) => {
      const resetTime = parseInt(row.dataset.rateLimitReset || '0', 10);
      const cooldownCell = row.querySelector('.cooldown-cell');
      const badge = row.querySelector('.status-badge');
      const statusText = row.querySelector('.status-text');

      if (!resetTime || isNaN(resetTime)) {
        if (cooldownCell) cooldownCell.textContent = '-';
        return;
      }

      if (resetTime > now) {
        if (cooldownCell) cooldownCell.textContent = this.formatCooldown(resetTime);
        if (badge && !badge.classList.contains('limited')) {
          badge.className = 'status-badge limited';
          if (statusText) statusText.textContent = 'Em cooldown';
        }
        return;
      }

      row.dataset.rateLimitReset = '';
      if (cooldownCell) cooldownCell.textContent = '-';
      if (badge && badge.classList.contains('limited')) {
        badge.className = 'status-badge available';
        if (statusText) statusText.textContent = 'Disponível';
      }
    });
  }

  private formatCooldown(resetTime: number | null): string {
    if (!resetTime || resetTime <= Date.now()) {
      return '-';
    }
    const remaining = Math.max(0, Math.floor((resetTime - Date.now()) / 1000));
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    if (m > 0) {
      return `${m}m ${s}s`;
    }
    return `${s}s`;
  }

  private showBanner(message: string, isError: boolean): void {
    const banner = document.getElementById('status-banner');
    if (!banner) {
      return;
    }
    banner.textContent = message;
    banner.style.display = 'flex';
    banner.className = `status-banner ${isError ? 'err' : 'ok'}`;
    setTimeout(() => {
      if (banner.textContent === message) {
        banner.style.display = 'none';
        banner.className = 'status-banner';
      }
    }, 3500);
  }
}
