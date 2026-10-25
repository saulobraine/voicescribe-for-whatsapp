import { ApiKey } from '../domain/ApiKey.js';
import { ModelIdentifier } from '../domain/ModelIdentifier.js';
import { ModelList } from '../domain/ModelList.js';
import { AudioDataUrl } from '../domain/AudioDataUrl.js';
import { TranscriptionText } from '../domain/TranscriptionText.js';
import { GeminiRateLimitError } from '../domain/GeminiRateLimitError.js';

export class GeminiApiClient {
  private readonly baseUrl: string;
  private smartModeUnsupported = false;

  constructor(baseUrl: string = 'https://generativelanguage.googleapis.com') {
    this.baseUrl = baseUrl;
  }

  public async listModels(apiKey: ApiKey): Promise<ModelList> {
    const url = `${this.baseUrl}/v1beta/models?pageSize=1000`;
    const response = await fetch(url, {
      headers: { 'x-goog-api-key': apiKey.toRawString() },
    });

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

    const hasDedicated = models.some((m) => m.toEndpointString() === 'gemini-3.5-transcribe');
    if (!hasDedicated) {
      models.push(new ModelIdentifier('gemini-3.5-transcribe'));
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
    const endpoint = `${this.baseUrl}/v1beta/models/${model.toEndpointString()}:generateContent`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Transcreva este áudio do WhatsApp. Preserve o idioma falado. Retorne somente a transcrição, sem comentários, introdução ou explicação.',
            },
            {
              inlineData: {
                mimeType: audio.extractMimeType(),
                data: audio.extractBase64Payload(),
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
      },
    };

    const result = await this.postJsonWithRetry(endpoint, apiKey, payload);
    if (!result.ok) {
      this.handleApiError(result.status, result.errorText, result.json, result.headers);
    }

    const candidateText = result.json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof candidateText !== 'string' || candidateText.trim().length === 0) {
      throw new Error('Nenhum texto foi retornado pela API Gemini para o áudio.');
    }

    return new TranscriptionText(candidateText.trim());
  }

  private async transcribeWithInteractions(apiKey: ApiKey, audio: AudioDataUrl): Promise<TranscriptionText> {
    const file = await this.uploadAudioFile(apiKey, audio);
    const mimeType = audio.extractMimeType();

    try {
      const endpoint = `${this.baseUrl}/v1beta/interactions`;
      const input = [{ type: 'audio', uri: file.uri, mime_type: mimeType }];

      let result = this.smartModeUnsupported
        ? await this.postJsonWithRetry(endpoint, apiKey, { model: 'gemini-3.5-transcribe', input })
        : await this.postJsonWithRetry(endpoint, apiKey, {
            model: 'gemini-3.5-transcribe',
            input,
            generation_config: { transcription_config: { mode: 'smart', thinkingLevel: 'minimal' } },
          });

      if (!result.ok && /thinking|Unknown (?:name|parameter)/i.test(result.errorText || '')) {
        this.smartModeUnsupported = true;
        result = await this.postJsonWithRetry(endpoint, apiKey, { model: 'gemini-3.5-transcribe', input });
      }

      if (!result.ok) {
        this.handleApiError(result.status, result.errorText, result.json, result.headers);
      }

      const text = this.extractInteractionText(result.json);
      if (text.length === 0) {
        console.error('[WGT] Resposta da API Interactions:', result.json);
        throw new Error('O Gemini Transcribe não retornou uma transcrição.');
      }

      return new TranscriptionText(text);
    } finally {
      if (file.name) {
        void this.deleteUploadedFile(apiKey, file.name);
      }
    }
  }

  public extractInteractionText(json: any): string {
    if (!json) {
      return '';
    }
    if (typeof json.output_text === 'string' && json.output_text.trim().length > 0) {
      return json.output_text.trim();
    }
    const steps = Array.isArray(json.steps) ? json.steps : [];
    const stepText = steps
      .flatMap((step: any) => (Array.isArray(step?.content) ? step.content : []))
      .filter((part: any) => part?.type === 'text')
      .map((part: any) => part?.text || '')
      .join('')
      .trim();
    if (stepText.length > 0) {
      return stepText;
    }
    if (typeof json.text === 'string' && json.text.trim().length > 0) {
      return json.text.trim();
    }
    if (typeof json.output?.transcription?.text === 'string' && json.output.transcription.text.trim().length > 0) {
      return json.output.transcription.text.trim();
    }
    const candidateParts = json.candidates?.[0]?.content?.parts || [];
    const candidateText = candidateParts.map((p: any) => p?.text || '').join('').trim();
    if (candidateText.length > 0) {
      return candidateText;
    }
    return '';
  }

  private async uploadAudioFile(apiKey: ApiKey, audio: AudioDataUrl): Promise<{ uri: string; name: string }> {
    const mimeType = audio.extractMimeType();
    const binaryData = Uint8Array.from(atob(audio.extractBase64Payload()), (c) => c.charCodeAt(0));

    const startUrl = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
    const startResponse = await fetch(startUrl, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey.toRawString(),
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(binaryData.byteLength),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: `whatsapp-audio-${Date.now()}` } }),
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      let errorJson: any = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch {}
      this.handleApiError(startResponse.status, errorJson?.error?.message || errorText, errorJson, startResponse.headers);
    }

    const uploadUrl = startResponse.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      throw new Error('O Google não retornou a URL de upload.');
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Length': String(binaryData.byteLength),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: binaryData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      let errorJson: any = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch {}
      this.handleApiError(uploadResponse.status, errorJson?.error?.message || errorText, errorJson, uploadResponse.headers);
    }

    const data = await uploadResponse.json();
    const file = data?.file;
    if (!file?.uri) {
      throw new Error('Falha ao obter URI do arquivo enviado ao Gemini.');
    }

    return { uri: file.uri, name: file.name || '' };
  }

  private async deleteUploadedFile(apiKey: ApiKey, fileName: string): Promise<void> {
    if (!fileName) {
      return;
    }
    const cleanName = fileName.startsWith('files/') ? fileName : `files/${fileName.split('/').pop()}`;
    const deleteUrl = `${this.baseUrl}/v1beta/${cleanName}`;
    try {
      await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { 'x-goog-api-key': apiKey.toRawString() },
      });
    } catch {
      // Falha silenciosa na remoção de arquivo temporário
    }
  }

  private async postJsonWithRetry(
    url: string,
    apiKey: ApiKey,
    payload: unknown
  ): Promise<{ ok: boolean; status: number; json: any; errorText: string; headers: Headers }> {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey.toRawString(),
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let parsedJson: any = null;
      try {
        parsedJson = JSON.parse(responseText);
      } catch {}

      const isRateLimit = response.status === 429;
      const isTransient = !response.ok && (response.status === 408 || response.status >= 500);

      if (isRateLimit || !isTransient || attempt >= 2) {
        return {
          ok: response.ok,
          status: response.status,
          json: parsedJson,
          errorText: parsedJson?.error?.message || responseText,
          headers: response.headers,
        };
      }

      await this.sleep(1000 * 2 ** attempt);
    }
  }

  public static parseRetryDelay(
    headers?: Headers | null,
    errorJson?: any,
    rawText?: string
  ): number {
    if (headers?.get) {
      const retryHeader = headers.get('retry-after');
      if (retryHeader) {
        const numericSeconds = parseFloat(retryHeader);
        if (!Number.isNaN(numericSeconds) && numericSeconds > 0) {
          return Math.ceil(numericSeconds * 1000);
        }
        const parsedDate = Date.parse(retryHeader);
        if (!Number.isNaN(parsedDate)) {
          const diff = parsedDate - Date.now();
          if (diff > 0) {
            return diff;
          }
        }
      }
    }

    const details = Array.isArray(errorJson?.error?.details) ? errorJson.error.details : [];
    for (const item of details) {
      const type = String(item?.['@type'] || '');
      if (type.includes('RetryInfo') || item?.retryDelay) {
        const delay = item.retryDelay;
        if (typeof delay === 'string') {
          const match = delay.match(/(\d+(?:\.\d+)?)\s*s/i);
          if (match) {
            return Math.ceil(parseFloat(match[1]) * 1000);
          }
        } else if (delay && typeof delay === 'object') {
          const seconds = parseInt(String(delay.seconds || '0'), 10);
          const nanos = parseInt(String(delay.nanos || '0'), 10);
          const totalMs = seconds * 1000 + Math.ceil(nanos / 1e6);
          if (totalMs > 0) {
            return totalMs;
          }
        }
      }
    }

    const combinedText = [errorJson?.error?.message, rawText].filter(Boolean).join(' ');
    if (combinedText) {
      const hMatch = combinedText.match(/(\d+)\s*h(?:ours?)?/i);
      const mMatch = combinedText.match(/(\d+)\s*m(?:in(?:utes?)?)?/i);
      const sMatch = combinedText.match(/(\d+(?:\.\d+)?)\s*s(?:ec(?:onds?)?)?/i);

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
    }

    return 60000;
  }

  private handleApiError(
    status: number,
    errorBody: string,
    errorJson?: any,
    headers?: Headers | null
  ): never {
    const isRateLimit = status === 429 || /quota|rate limit|resource_exhausted/i.test(errorBody);
    if (isRateLimit) {
      const delayMs = GeminiApiClient.parseRetryDelay(headers, errorJson, errorBody);
      const seconds = Math.ceil(delayMs / 1000);
      throw new GeminiRateLimitError(
        `Limite da API excedido (cota esgotada nesta chave). Tente novamente em ${seconds}s.`,
        delayMs,
        errorJson || errorBody
      );
    }
    if (/high demand|overloaded/i.test(errorBody)) {
      throw new Error('A API do Gemini está sob alta demanda no momento.');
    }
    throw new Error(`Erro na API do Gemini (${status}): ${errorBody}`);
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
