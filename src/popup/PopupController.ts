import { ChromeStorageGateway } from '../infrastructure/ChromeStorageGateway.js';
import { ApiKeyPool } from '../domain/ApiKeyPool.js';

export class PopupController {
  private static readonly DEFAULT_MODEL = 'gemini-3.8-flash';
  private readonly storage: ChromeStorageGateway;

  private modelSelect: HTMLSelectElement | null = null;
  private statusElement: HTMLElement | null = null;

  constructor(storage: ChromeStorageGateway = new ChromeStorageGateway()) {
    this.storage = storage;
  }

  public async initialize(): Promise<void> {
    this.modelSelect = document.getElementById('model') as HTMLSelectElement;
    this.statusElement = document.getElementById('status');

    this.bindEvents();

    const selectedModel = await this.storage.getSelectedModel();
    await this.loadModels(selectedModel, false);
  }

  private bindEvents(): void {
    document.getElementById('refresh')?.addEventListener('click', async () => {
      const current = this.modelSelect?.value || PopupController.DEFAULT_MODEL;
      await this.loadModels(current, true);
    });

    document.getElementById('save')?.addEventListener('click', async () => {
      const selected = this.modelSelect?.value.trim() || PopupController.DEFAULT_MODEL;
      await this.storage.setSelectedModel(selected);
      this.setStatus('Configuração salva com sucesso.', false);
    });

    document.getElementById('test')?.addEventListener('click', () => {
      void this.testSelectedModel();
    });

    document.getElementById('clear-cache')?.addEventListener('click', () => {
      void this.clearCache();
    });
  }

  private async loadModels(selectedModel: string, showStatus: boolean): Promise<void> {
    if (showStatus) {
      this.setStatus('Buscando modelos com áudio...', false);
    }
    if (this.modelSelect) {
      this.modelSelect.disabled = true;
    }

    try {
      const response = await chrome.runtime.sendMessage({ action: 'listAudioModels' });
      if (!response?.success) {
        throw new Error(response?.error || 'Não foi possível listar os modelos.');
      }
      this.populateModels(response.models || [], selectedModel);
      if (showStatus) {
        this.setStatus(`${response.models.length} modelo(s) compatível(is) encontrado(s).`, false);
      }
    } catch (error: unknown) {
      this.handleLoadModelsError(error);
    } finally {
      if (this.modelSelect) {
        this.modelSelect.disabled = false;
      }
    }
  }

  private populateModels(models: Array<{ id: string; name: string; transcribe: boolean }>, selectedModel: string): void {
    if (!this.modelSelect) {
      return;
    }
    this.modelSelect.innerHTML = '';

    if (models.length === 0) {
      this.modelSelect.innerHTML = '<option value="">Nenhum modelo compatível encontrado</option>';
      return;
    }

    const dedicated = models.filter((m) => m.transcribe);
    const multimodal = models.filter((m) => !m.transcribe);

    if (dedicated.length > 0) {
      const group = document.createElement('optgroup');
      group.label = 'Transcrição dedicada';
      dedicated.forEach((m) => this.addOption(group, m));
      this.modelSelect.appendChild(group);
    }

    if (multimodal.length > 0) {
      const group = document.createElement('optgroup');
      group.label = 'Gemini multimodal';
      multimodal.forEach((m) => this.addOption(group, m));
      this.modelSelect.appendChild(group);
    }

    const exists = models.some((m) => m.id === selectedModel);
    this.modelSelect.value = exists
      ? selectedModel
      : dedicated[0]?.id || multimodal[0]?.id || PopupController.DEFAULT_MODEL;
  }

  private addOption(parent: HTMLElement, item: { id: string; name: string }): void {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    parent.appendChild(option);
  }

  private handleLoadModelsError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const isNoKeys = message.includes('painel') || message.includes('chaves');
    if (this.modelSelect) {
      this.modelSelect.innerHTML = isNoKeys
        ? '<option>Configure suas chaves no painel</option>'
        : '<option>Falha ao carregar modelos</option>';
    }
    this.setStatus(message, true);
  }

  private async testSelectedModel(): Promise<void> {
    const selected = this.modelSelect?.value.trim() || PopupController.DEFAULT_MODEL;
    const stored = await this.storage.getStoredKeys();
    const pool = new ApiKeyPool(stored);
    const activeKey = pool.getAvailableKey();

    if (!activeKey) {
      this.setStatus('Nenhuma chave ativa. Adicione chaves em Gerenciar API Keys.', true);
      return;
    }

    this.setStatus('Testando modelo...', false);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selected)}:generateContent?key=${encodeURIComponent(activeKey.key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Responda apenas: OK' }] }] }),
        }
      );
      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson?.error?.message || `HTTP ${response.status}`);
      }
      this.setStatus('Chave e modelo testados e disponíveis com sucesso!', false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(message, true);
    }
  }

  private async clearCache(): Promise<void> {
    if (!confirm('Deseja realmente zerar todo o cache de transcrições salvas?')) {
      return;
    }
    const removedCount = await this.storage.clearAllCache();
    this.setStatus(`Cache zerado: ${removedCount} transcrições removidas.`, false);
  }

  private setStatus(message: string, isError: boolean): void {
    if (!this.statusElement) {
      return;
    }
    this.statusElement.textContent = message;
    this.statusElement.className = `status ${isError ? 'err' : 'ok'}`;
  }
}
