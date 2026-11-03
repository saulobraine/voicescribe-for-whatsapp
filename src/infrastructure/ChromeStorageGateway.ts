export interface StoredApiKeyRecord {
  id: string;
  key: string;
  active: boolean;
  status: 'available' | 'rate_limited';
  rateLimitReset: number | null;
  usageCount: number;
  lastUsed: number;
}

export class ChromeStorageGateway {
  private static readonly STORAGE_KEYS = 'geminiKeys';
  private static readonly STORAGE_LEGACY_KEY = 'geminiKey';
  private static readonly STORAGE_SELECTED_MODEL = 'selectedModel';
  private static readonly STORAGE_AUTO_TRANSCRIBE = 'auto_transcribe_enabled';
  private static readonly DEFAULT_MODEL = 'gemini-3.8-flash';
  private static readonly MSG_CACHE_PREFIX = 'wgt_msg_cache_';

  public async getStoredKeys(): Promise<StoredApiKeyRecord[]> {
    if (!this.isStorageAvailable()) {
      return [];
    }
    const data = await this.executeSafeStorageGet([
      ChromeStorageGateway.STORAGE_KEYS,
      ChromeStorageGateway.STORAGE_LEGACY_KEY,
    ]);
    const keys: StoredApiKeyRecord[] = Array.isArray(data[ChromeStorageGateway.STORAGE_KEYS])
      ? (data[ChromeStorageGateway.STORAGE_KEYS] as StoredApiKeyRecord[])
      : [];

    if (keys.length === 0 && typeof data[ChromeStorageGateway.STORAGE_LEGACY_KEY] === 'string') {
      return this.migrateLegacyKey(data[ChromeStorageGateway.STORAGE_LEGACY_KEY] as string);
    }

    return keys;
  }

  private async migrateLegacyKey(rawLegacyKey: string): Promise<StoredApiKeyRecord[]> {
    const legacyKey = rawLegacyKey.trim();
    if (legacyKey.length === 0) {
      return [];
    }
    const migrated: StoredApiKeyRecord = {
      id: `wgt_${Date.now().toString(36)}`,
      key: legacyKey,
      active: true,
      status: 'available',
      rateLimitReset: null,
      usageCount: 0,
      lastUsed: Date.now(),
    };
    await this.saveStoredKeys([migrated]);
    return [migrated];
  }

  public async saveStoredKeys(keys: StoredApiKeyRecord[]): Promise<void> {
    if (!this.isStorageAvailable()) {
      return;
    }
    await this.executeSafeStorageSet({ [ChromeStorageGateway.STORAGE_KEYS]: keys });
  }

  public async getSelectedModel(): Promise<string> {
    if (!this.isStorageAvailable()) {
      return ChromeStorageGateway.DEFAULT_MODEL;
    }
    const data = await this.executeSafeStorageGet([ChromeStorageGateway.STORAGE_SELECTED_MODEL]);
    const model = data[ChromeStorageGateway.STORAGE_SELECTED_MODEL];
    if (typeof model === 'string' && model.trim().length > 0) {
      return model.trim();
    }
    return ChromeStorageGateway.DEFAULT_MODEL;
  }

  public async setSelectedModel(modelName: string): Promise<void> {
    if (!this.isStorageAvailable()) {
      return;
    }
    await this.executeSafeStorageSet({ [ChromeStorageGateway.STORAGE_SELECTED_MODEL]: modelName });
  }

  public async isAutoTranscribeEnabled(): Promise<boolean> {
    if (!this.isStorageAvailable()) {
      return false;
    }
    const data = await this.executeSafeStorageGet([ChromeStorageGateway.STORAGE_AUTO_TRANSCRIBE]);
    return Boolean(data[ChromeStorageGateway.STORAGE_AUTO_TRANSCRIBE]);
  }

  public async setAutoTranscribeEnabled(enabled: boolean): Promise<void> {
    if (!this.isStorageAvailable()) {
      return;
    }
    await this.executeSafeStorageSet({ [ChromeStorageGateway.STORAGE_AUTO_TRANSCRIBE]: enabled });
  }

  public async getCachedTranscription(messageId: string): Promise<string | null> {
    if (!this.isStorageAvailable() || messageId.length === 0) {
      return null;
    }
    const sanitized = String(messageId).replace(/[^a-zA-Z0-9_@-]/g, '_');
    const key = `${ChromeStorageGateway.MSG_CACHE_PREFIX}${sanitized}`;
    const result = await this.executeSafeStorageGet([key]);
    return this.extractCachedTranscriptText(result[key]);
  }

  private extractCachedTranscriptText(record: unknown): string | null {
    if (typeof record === 'string' && record.trim().length > 0) {
      return record;
    }
    if (record && typeof (record as any).transcript === 'string') {
      return (record as any).transcript;
    }
    return null;
  }

  public async saveCachedTranscription(messageId: string, text: string): Promise<void> {
    if (!this.isStorageAvailable() || messageId.length === 0) {
      return;
    }
    const sanitized = String(messageId).replace(/[^a-zA-Z0-9_@-]/g, '_');
    const key = `${ChromeStorageGateway.MSG_CACHE_PREFIX}${sanitized}`;
    await this.executeSafeStorageSet({
      [key]: {
        transcript: text,
        timestamp: Date.now(),
        id: messageId,
      },
    });
  }

  public async clearAllCache(): Promise<number> {
    if (!this.isStorageAvailable()) {
      return 0;
    }
    const all = await this.executeSafeStorageGet(null);
    const keysToRemove = Object.keys(all).filter((key) =>
      key.startsWith(ChromeStorageGateway.MSG_CACHE_PREFIX) ||
      key.startsWith('wgt_cache_') ||
      key.startsWith('wgt_quota_cooldown')
    );
    if (keysToRemove.length > 0) {
      await this.executeSafeStorageRemove(keysToRemove);
    }
    return keysToRemove.length;
  }

  public isStorageAvailable(): boolean {
    return this.checkStorageRuntimeValidity();
  }

  private checkStorageRuntimeValidity(): boolean {
    try {
      return this.hasActiveChromeRuntimeStorage();
    } catch {
      return false;
    }
  }

  private hasActiveChromeRuntimeStorage(): boolean {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
      return false;
    }
    return Boolean(chrome.storage?.local);
  }

  private async executeSafeStorageGet(keys: string[] | null): Promise<Record<string, unknown>> {
    try {
      return await chrome.storage.local.get(keys);
    } catch {
      return {};
    }
  }

  private async executeSafeStorageSet(items: Record<string, unknown>): Promise<void> {
    try {
      await chrome.storage.local.set(items);
    } catch {
      // Silencia erros caso o contexto da extensão tenha sido invalidado
    }
  }

  private async executeSafeStorageRemove(keys: string[]): Promise<void> {
    try {
      await chrome.storage.local.remove(keys);
    } catch {
      // Silencia erros caso o contexto da extensão tenha sido invalidado
    }
  }
}
