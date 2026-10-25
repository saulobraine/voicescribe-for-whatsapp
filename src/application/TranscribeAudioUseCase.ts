import { ChromeStorageGateway } from '../infrastructure/ChromeStorageGateway.js';
import { GeminiApiClient } from '../infrastructure/GeminiApiClient.js';
import { ApiKeyPool } from '../domain/ApiKeyPool.js';
import { ApiKey } from '../domain/ApiKey.js';
import { ModelIdentifier } from '../domain/ModelIdentifier.js';
import { AudioDataUrl } from '../domain/AudioDataUrl.js';
import { GeminiRateLimitError } from '../domain/GeminiRateLimitError.js';

export class TranscribeAudioUseCase {
  private readonly storage: ChromeStorageGateway;
  private readonly apiClient: GeminiApiClient;

  constructor(storage: ChromeStorageGateway, apiClient: GeminiApiClient) {
    this.storage = storage;
    this.apiClient = apiClient;
  }

  public async execute(audioDataUrlString: string): Promise<string> {
    const audio = new AudioDataUrl(audioDataUrlString);
    const selectedModelName = await this.storage.getSelectedModel();
    const model = new ModelIdentifier(selectedModelName);

    const triedKeyIds: string[] = [];
    let lastError: Error = new Error('Falha desconhecida na transcrição.');

    while (true) {
      const storedRecords = await this.storage.getStoredKeys();
      let pool = new ApiKeyPool(storedRecords);

      if (pool.count() === 0) {
        throw new Error('Configure suas chaves Gemini no painel administrativo primeiro.');
      }

      const activeRecord = pool.getAvailableKey(triedKeyIds);
      if (!activeRecord) {
        const nextReset = pool.getNextResetTimestamp();
        if (nextReset) {
          const resetTime = new Date(nextReset).toLocaleTimeString('pt-BR');
          throw new Error(`Limite da API atingido em todas as chaves do pool. Tente novamente após ${resetTime}.`);
        }
        throw lastError;
      }

      triedKeyIds.push(activeRecord.id);
      const apiKey = new ApiKey(activeRecord.key);

      try {
        const result = await this.apiClient.transcribeAudio(apiKey, model, audio);
        pool = pool.incrementUsage(activeRecord.id);
        await this.storage.saveStoredKeys([...pool.getAll()]);
        return result.toDisplayText();
      } catch (error: unknown) {
        if (error instanceof GeminiRateLimitError) {
          const resetTimestamp = Date.now() + error.retryDelayMs;
          pool = pool.markRateLimited(activeRecord.id, resetTimestamp);
          await this.storage.saveStoredKeys([...pool.getAll()]);
          lastError = error;
          continue;
        }

        const message = error instanceof Error ? error.message : String(error);
        lastError = error instanceof Error ? error : new Error(message);

        const isRateLimit = this.isRateLimitError(message);
        if (!isRateLimit) {
          throw lastError;
        }

        const cooldownMs = this.parseCooldownMilliseconds(message);
        const resetTimestamp = Date.now() + cooldownMs;
        pool = pool.markRateLimited(activeRecord.id, resetTimestamp);
        await this.storage.saveStoredKeys([...pool.getAll()]);
      }
    }
  }

  private isRateLimitError(errorMessage: string): boolean {
    const lower = errorMessage.toLowerCase();
    return lower.includes('quota') ||
           lower.includes('rate limit') ||
           lower.includes('resource_exhausted') ||
           lower.includes('429') ||
           lower.includes('limite da api');
  }

  private parseCooldownMilliseconds(errorMessage: string): number {
    const hMatch = errorMessage.match(/(\d+)\s*h(?:ours?)?/i);
    const mMatch = errorMessage.match(/(\d+)\s*m(?:in(?:utes?)?)?/i);
    const sMatch = errorMessage.match(/(\d+(?:\.\d+)?)\s*s(?:ec(?:onds?)?)?/i);

    let totalMs = 0;
    if (hMatch) {
      totalMs += parseInt(hMatch[1] || '0', 10) * 3600000;
    }
    if (mMatch) {
      totalMs += parseInt(mMatch[1] || '0', 10) * 60000;
    }
    if (sMatch) {
      totalMs += Math.ceil(parseFloat(sMatch[1] || '0') * 1000);
    }

    if (totalMs >= 1000) {
      return totalMs;
    }
    return 60000;
  }
}
