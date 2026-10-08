import { ApiKey } from '../domain/ApiKey.js';
import { ModelIdentifier } from '../domain/ModelIdentifier.js';
import { ModelList } from '../domain/ModelList.js';
import { AudioDataUrl } from '../domain/AudioDataUrl.js';
import { TranscriptionText } from '../domain/TranscriptionText.js';

export class GeminiApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = 'https://generativelanguage.googleapis.com') {
    this.baseUrl = baseUrl;
  }

  public async listModels(apiKey: ApiKey): Promise<ModelList> {
    const url = `${this.baseUrl}/v1beta/models?key=${encodeURIComponent(apiKey.toRawString())}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Falha ao listar modelos do Gemini (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    const rawList = Array.isArray(data.models) ? data.models : [];
    const models: ModelIdentifier[] = [];

    for (const item of rawList) {
      const name = typeof item.name === 'string' ? item.name.replace(/^models\//, '') : '';
      if (name.length > 0) {
        models.push(new ModelIdentifier(name));
      }
    }

    return new ModelList(models).filterAudioCompatible();
  }

  public async transcribeAudio(
    apiKey: ApiKey,
    model: ModelIdentifier,
    audio: AudioDataUrl
  ): Promise<TranscriptionText> {
    if (model.isDedicatedTranscriber()) {
      return this.transcribeWithInteractions(apiKey, audio);
    }
    return this.transcribeWithGenerateContent(apiKey, model, audio);
  }

  private async transcribeWithGenerateContent(
    apiKey: ApiKey,
    model: ModelIdentifier,
    audio: AudioDataUrl
  ): Promise<TranscriptionText> {
    const endpoint = `${this.baseUrl}/v1beta/models/${model.toEndpointString()}:generateContent?key=${encodeURIComponent(apiKey.toRawString())}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: audio.extractMimeType(),
                data: audio.extractBase64Payload(),
              },
            },
            {
              text: 'Transcreva com precisão o áudio acima em português brasileiro. Retorne apenas o texto transcrito, sem introduções ou explicações.',
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      await this.handleApiError(response);
    }

    const json = await response.json();
    const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof candidateText !== 'string' || candidateText.trim().length === 0) {
      throw new Error('Nenhum texto foi retornado pela API Gemini para o áudio.');
    }

    return new TranscriptionText(candidateText);
  }

  private async transcribeWithInteractions(apiKey: ApiKey, audio: AudioDataUrl): Promise<TranscriptionText> {
    // Para modelos de interação dedicados
    const fileUri = await this.uploadAudioFile(apiKey, audio);
    try {
      const endpoint = `${this.baseUrl}/v1beta/interactions?key=${encodeURIComponent(apiKey.toRawString())}`;
      const payload = {
        model: 'gemini-3.5-transcribe',
        input: {
          audio: { uri: fileUri },
        },
        transcription_config: { mode: 'smart' },
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        await this.handleApiError(response);
      }

      const json = await response.json();
      const text = json.output?.transcription?.text || json.text || '';
      return new TranscriptionText(text);
    } finally {
      void this.deleteUploadedFile(apiKey, fileUri);
    }
  }

  private async uploadAudioFile(apiKey: ApiKey, audio: AudioDataUrl): Promise<string> {
    const mimeType = audio.extractMimeType();
    const binaryData = Uint8Array.from(atob(audio.extractBase64Payload()), (c) => c.charCodeAt(0));
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(apiKey.toRawString())}`;

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Command': 'start, upload, finalize',
        'X-Goog-Upload-Header-Content-Length': String(binaryData.byteLength),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': mimeType,
      },
      body: binaryData,
    });

    if (!response.ok) {
      await this.handleApiError(response);
    }

    const data = await response.json();
    const uri = data.file?.uri;
    if (!uri) {
      throw new Error('Falha ao obter URI do arquivo enviado ao Gemini.');
    }
    return uri;
  }

  private async deleteUploadedFile(apiKey: ApiKey, fileUri: string): Promise<void> {
    const fileName = fileUri.split('/').pop();
    if (!fileName) {
      return;
    }
    const deleteUrl = `${this.baseUrl}/v1beta/files/${fileName}?key=${encodeURIComponent(apiKey.toRawString())}`;
    try {
      await fetch(deleteUrl, { method: 'DELETE' });
    } catch {
      // Falha silenciosa na remoção de arquivo temporário
    }
  }

  private async handleApiError(response: Response): Promise<never> {
    const status = response.status;
    const errorBody = await response.text();

    if (status === 429 || /quota|rate limit/i.test(errorBody)) {
      throw new Error('Limite da API excedido (cota esgotada nesta chave). Tente alternar chave.');
    }
    if (/high demand|overloaded/i.test(errorBody)) {
      throw new Error('A API do Gemini está sob alta demanda no momento.');
    }
    throw new Error(`Erro na API do Gemini (${status}): ${errorBody}`);
  }
}
