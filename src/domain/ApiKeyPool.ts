import { StoredApiKeyRecord } from '../infrastructure/ChromeStorageGateway.js';
import { ApiKey } from './ApiKey.js';

export class ApiKeyPool {
  private readonly records: readonly StoredApiKeyRecord[];

  constructor(records: readonly StoredApiKeyRecord[] = []) {
    this.records = Object.freeze([...records]);
  }

  public count(): number {
    return this.records.length;
  }

  public getAll(): readonly StoredApiKeyRecord[] {
    return this.records;
  }

  public getAvailableKey(excludeIds: string[] = []): StoredApiKeyRecord | null {
    const now = Date.now();
    const available = this.records.filter((item) => {
      if (!item.active) {
        return false;
      }
      if (excludeIds.includes(item.id)) {
        return false;
      }
      if (item.status === 'rate_limited' && item.rateLimitReset && item.rateLimitReset > now) {
        return false;
      }
      return true;
    });

    if (available.length === 0) {
      return null;
    }

    return [...available].sort((a, b) => (a.usageCount || 0) - (b.usageCount || 0))[0];
  }

  public getNextResetTimestamp(): number | null {
    const now = Date.now();
    const limited = this.records
      .filter((k) => k.active && k.rateLimitReset && k.rateLimitReset > now)
      .sort((a, b) => (a.rateLimitReset || 0) - (b.rateLimitReset || 0));

    if (limited.length === 0) {
      return null;
    }
    return limited[0]?.rateLimitReset || null;
  }

  public addKey(rawKey: string): ApiKeyPool {
    const validatedKey = new ApiKey(rawKey);
    const exists = this.records.some((item) => item.key === validatedKey.toRawString());
    if (exists) {
      throw new Error('Esta chave de API já está cadastrada no pool.');
    }

    const newRecord: StoredApiKeyRecord = {
      id: `wgt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      key: validatedKey.toRawString(),
      active: true,
      status: 'available',
      rateLimitReset: null,
      usageCount: 0,
      lastUsed: Date.now(),
    };

    return new ApiKeyPool([...this.records, newRecord]);
  }

  public removeKey(targetId: string): ApiKeyPool {
    const filtered = this.records.filter((item) => item.id !== targetId);
    return new ApiKeyPool(filtered);
  }

  public toggleKey(targetId: string): ApiKeyPool {
    const updated = this.records.map((item) => {
      if (item.id !== targetId) {
        return item;
      }
      return {
        ...item,
        active: !item.active,
      };
    });
    return new ApiKeyPool(updated);
  }

  public markRateLimited(keyId: string, resetTimestamp: number): ApiKeyPool {
    const updated = this.records.map((item) => {
      if (item.id !== keyId) {
        return item;
      }
      return {
        ...item,
        status: 'rate_limited' as const,
        rateLimitReset: resetTimestamp,
      };
    });
    return new ApiKeyPool(updated);
  }

  public incrementUsage(keyId: string): ApiKeyPool {
    const updated = this.records.map((item) => {
      if (item.id !== keyId) {
        return item;
      }
      return {
        ...item,
        usageCount: (item.usageCount || 0) + 1,
        lastUsed: Date.now(),
        status: 'available' as const,
        rateLimitReset: null,
      };
    });
    return new ApiKeyPool(updated);
  }
}
