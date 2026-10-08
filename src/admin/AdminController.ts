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
    const addKeyButton = document.getElementById('add-key-btn');
    addKeyButton?.addEventListener('click', () => {
      void this.promptAndAddKey();
    });
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
    const tbody = document.getElementById('keys-table');
    if (!tbody) {
      return;
    }
    tbody.innerHTML = '';

    if (records.length === 0) {
      this.renderEmptyState(tbody);
      return;
    }

    records.forEach((record) => {
      const row = this.createTableRow(record);
      tbody.appendChild(row);
    });
  }

  private renderEmptyState(tbody: HTMLElement): void {
    const row = document.createElement('tr');
    row.innerHTML =
      '<td colspan="6" style="text-align:center;color:#667781;padding:16px">' +
      'Nenhuma chave configurada. Clique em <strong>➕ Adicionar Nova Chave</strong> acima.</td>';
    tbody.appendChild(row);
  }

  private createTableRow(record: StoredApiKeyRecord): HTMLTableRowElement {
    const row = document.createElement('tr');
    row.dataset.keyId = record.id;
    row.dataset.rateLimitReset = String(record.rateLimitReset || '');

    const isLimited = record.status === 'rate_limited' && Boolean(record.rateLimitReset && record.rateLimitReset > Date.now());
    const statusClass = isLimited ? 'status-limited' : 'status-available';
    const statusText = isLimited ? '🕐 Em cooldown' : '✅ Disponível';
    const cooldownText = this.formatCooldown(record.rateLimitReset);

    const maskedKey = this.maskKey(record.key);

    row.innerHTML = `
      <td><code style="font-family:monospace;font-size:12px">${maskedKey}</code></td>
      <td class="status-cell ${statusClass}">${statusText}</td>
      <td class="cooldown-cell">${cooldownText}</td>
      <td>${record.usageCount || 0}</td>
      <td class="toggle-cell"></td>
      <td class="action-cell"></td>
    `;

    const toggleButton = this.createToggleButton(record);
    const removeButton = this.createRemoveButton(record.id);

    row.querySelector('.toggle-cell')?.appendChild(toggleButton);
    row.querySelector('.action-cell')?.appendChild(removeButton);

    return row;
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

  private createRemoveButton(keyId: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'btn btn-danger';
    button.style.cssText = 'font-size:12px;padding:4px 8px';
    button.textContent = '🗑️';
    button.title = 'Remover chave';
    button.addEventListener('click', () => {
      void this.removeKey(keyId);
    });
    return button;
  }

  private async promptAndAddKey(): Promise<void> {
    const input = prompt('Insira a chave da API do Gemini (AIza...):');
    if (!input || input.trim().length === 0) {
      return;
    }

    try {
      const records = await this.storage.getStoredKeys();
      const pool = new ApiKeyPool(records);
      const updatedPool = pool.addKey(input.trim());
      await this.storage.saveStoredKeys([...updatedPool.getAll()]);
      this.showBanner('Chave adicionada com sucesso!', false);
      await this.refreshTable();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.showBanner(message, true);
    }
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
      const statusCell = row.querySelector('.status-cell');

      if (!resetTime || isNaN(resetTime)) {
        if (cooldownCell) {
          cooldownCell.textContent = '-';
        }
        return;
      }

      if (resetTime > now) {
        if (cooldownCell) {
          cooldownCell.textContent = this.formatCooldown(resetTime);
        }
        if (statusCell && !statusCell.classList.contains('status-limited')) {
          statusCell.className = 'status-cell status-limited';
          statusCell.textContent = '🕐 Em cooldown';
        }
        return;
      }

      row.dataset.rateLimitReset = '';
      if (cooldownCell) {
        cooldownCell.textContent = '-';
      }
      if (statusCell && statusCell.classList.contains('status-limited')) {
        statusCell.className = 'status-cell status-available';
        statusCell.textContent = '✅ Disponível';
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
    banner.style.display = 'block';
    banner.className = `status-banner ${isError ? 'err' : 'ok'}`;
    setTimeout(() => {
      if (banner.textContent === message) {
        banner.style.display = 'none';
        banner.className = 'status-banner';
      }
    }, 3500);
  }
}
