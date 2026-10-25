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
  private static readonly DEFAULT_MODEL = 'gemini-3.8-flash';
  private static readonly MSG_CACHE_PREFIX = 'wgt_msg_cache_';

  public async getStoredKeys(): Promise<StoredApiKeyRecord[]> {
    if (!this.isStorageAvailable()) {
      return [];
    }
    const data = await chrome.storage.local.get([
      ChromeStorageGateway.STORAGE_KEYS,
      ChromeStorageGateway.STORAGE_LEGACY_KEY,
    ]);
    const keys: StoredApiKeyRecord[] = Array.isArray(data[ChromeStorageGateway.STORAGE_KEYS])
      ? data[ChromeStorageGateway.STORAGE_KEYS]
      : [];

    if (keys.length === 0 && typeof data[ChromeStorageGateway.STORAGE_LEGACY_KEY] === 'string') {
      const legacyKey = data[ChromeStorageGateway.STORAGE_LEGACY_KEY].trim();
      if (legacyKey.length > 0) {
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
    }

    return keys;
  }

  public async saveStoredKeys(keys: StoredApiKeyRecord[]): Promise<void> {
    if (!this.isStorageAvailable()) {
      return;
    }
    await chrome.storage.local.set({ [ChromeStorageGateway.STORAGE_KEYS]: keys });
  }

  public async getSelectedModel(): Promise<string> {
    if (!this.isStorageAvailable()) {
      return ChromeStorageGateway.DEFAULT_MODEL;
    }
    const data = await chrome.storage.local.get([ChromeStorageGateway.STORAGE_SELECTED_MODEL]);
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
    await chrome.storage.local.set({ [ChromeStorageGateway.STORAGE_SELECTED_MODEL]: modelName });
  }

  public async getCachedTranscription(messageId: string): Promise<string | null> {
    if (!this.isStorageAvailable() || messageId.length === 0) {
      return null;
    }
    const sanitized = String(messageId).replace(/[^a-zA-Z0-9_@-]/g, '_');
    const key = `${ChromeStorageGateway.MSG_CACHE_PREFIX}${sanitized}`;
    const result = await chrome.storage.local.get([key]);
    const record = result[key];
    if (typeof record === 'string' && record.trim().length > 0) {
      return record;
    }
    if (record && typeof record.transcript === 'string') {
      return record.transcript;
    }
    return null;
  }

  public async saveCachedTranscription(messageId: string, text: string): Promise<void> {
    if (!this.isStorageAvailable() || messageId.length === 0) {
      return;
    }
    const sanitized = String(messageId).replace(/[^a-zA-Z0-9_@-]/g, '_');
    const key = `${ChromeStorageGateway.MSG_CACHE_PREFIX}${sanitized}`;
    await chrome.storage.local.set({
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
    const all = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(all).filter((key) =>
      key.startsWith(ChromeStorageGateway.MSG_CACHE_PREFIX) ||
      key.startsWith('wgt_cache_') ||
      key.startsWith('wgt_quota_cooldown')
    );
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
    return keysToRemove.length;
  }

  private isStorageAvailable(): boolean {
    return Boolean(typeof chrome !== 'undefined' && chrome.storage?.local);
  }
}
