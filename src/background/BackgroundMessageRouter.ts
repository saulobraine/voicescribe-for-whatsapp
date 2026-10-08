import { TranscribeAudioUseCase } from '../application/TranscribeAudioUseCase.js';
import { GeminiApiClient } from '../infrastructure/GeminiApiClient.js';
import { ChromeStorageGateway } from '../infrastructure/ChromeStorageGateway.js';
import { ApiKeyPool } from '../domain/ApiKeyPool.js';
import { ApiKey } from '../domain/ApiKey.js';

export class BackgroundMessageRouter {
  private readonly transcribeUseCase: TranscribeAudioUseCase;
  private readonly apiClient: GeminiApiClient;
  private readonly storage: ChromeStorageGateway;

  constructor(
    storage: ChromeStorageGateway = new ChromeStorageGateway(),
    apiClient: GeminiApiClient = new GeminiApiClient(),
    transcribeUseCase?: TranscribeAudioUseCase
  ) {
    this.storage = storage;
    this.apiClient = apiClient;
    this.transcribeUseCase = transcribeUseCase || new TranscribeAudioUseCase(storage, apiClient);
  }

  public register(): void {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      this.routeMessage(message)
        .then((response) => sendResponse(response))
        .catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          sendResponse({ success: false, error: errorMessage });
        });
      return true;
    });
  }

  private async routeMessage(message: any): Promise<any> {
    const action = message?.action;

    if (action === 'listAudioModels') {
      return this.handleListAudioModels();
    }

    if (action === 'transcribeAudio' || action === 'transcribe') {
      const dataUrl = message.audioData || message.dataUrl;
      if (!dataUrl) {
        throw new Error('Nenhum dado de áudio foi fornecido para transcrição.');
      }
      const text = await this.transcribeUseCase.execute(dataUrl);
      return { success: true, data: text, text };
    }

    throw new Error(`Ação desconhecida: ${String(action)}`);
  }

  private async handleListAudioModels(): Promise<{ success: boolean; models: any[] }> {
    const stored = await this.storage.getStoredKeys();
    const pool = new ApiKeyPool(stored);
    const activeRecord = pool.getAvailableKey();

    if (!activeRecord) {
      throw new Error('Configure suas chaves Gemini no painel administrativo primeiro.');
    }

    const apiKey = new ApiKey(activeRecord.key);
    const modelList = await this.apiClient.listModels(apiKey);

    const formatted = modelList.toNames().map((modelName) => ({
      id: modelName,
      name: modelName,
      description: modelName.includes('transcribe') ? 'Modelo dedicado a transcrição' : 'Modelo multimodal Gemini',
      transcribe: modelName.includes('transcribe'),
    }));

    return { success: true, models: formatted };
  }
}
