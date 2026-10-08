/**
 * Interceptor de rede e criação de blobs de áudio injetado no contexto nativo da página.
 * Segue regras de Object Calisthenics: apenas 1 nível de indentação por método, sem else.
 */
export class PageAudioInterceptor {
  private static readonly MAX_STORED_BLOBS = 25;
  private readonly capturedBlobs: Map<string, { blob: Blob; timestamp: number }>;

  constructor() {
    this.capturedBlobs = new Map();
  }

  public start(): void {
    this.interceptCreateObjectURL();
    this.interceptFetch();
    this.interceptXmlHttpRequest();
    this.listenForAudioRequests();
  }

  private interceptCreateObjectURL(): void {
    const originalCreate = URL.createObjectURL.bind(URL);
    const self = this;

    URL.createObjectURL = function (object: Blob | MediaSource): string {
      const url = originalCreate(object);
      if (object instanceof Blob && self.isAudioBlob(object)) {
        self.registerAudioBlob(url, object);
      }
      return url;
    };
  }

  private interceptFetch(): void {
    const originalFetch = window.fetch.bind(window);
    const self = this;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const response = await originalFetch(input, init);
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      if (self.isAudioNetworkUrl(url)) {
        void self.captureFetchResponse(response.clone(), url);
      }
      return response;
    };
  }

  private interceptXmlHttpRequest(): void {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const self = this;

    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest & { _wgtUrl?: string },
      method: string,
      url: string | URL,
      ...rest: any[]
    ): void {
      this._wgtUrl = String(url);
      return (originalOpen as any).apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest & { _wgtUrl?: string },
      body?: Document | XMLHttpRequestBodyInit | null
    ): void {
      const url = this._wgtUrl || '';
      if (self.isAudioNetworkUrl(url)) {
        this.addEventListener('load', () => {
          if (this.response instanceof Blob && self.isAudioBlob(this.response)) {
            self.registerAudioBlob(url, this.response);
          }
        });
      }
      return originalSend.apply(this, [body]);
    };
  }

  private async captureFetchResponse(response: Response, url: string): Promise<void> {
    try {
      const blob = await response.blob();
      if (this.isAudioBlob(blob)) {
        this.registerAudioBlob(url, blob);
      }
    } catch {
      // Ignora falhas de leitura de stream
    }
  }

  private registerAudioBlob(url: string, blob: Blob): void {
    const timestamp = Date.now();
    this.capturedBlobs.set(url, { blob, timestamp });
    this.pruneOldBlobs();

    window.dispatchEvent(
      new CustomEvent('wgt-audio', {
        detail: { url, timestamp, blob },
      })
    );
  }

  private pruneOldBlobs(): void {
    if (this.capturedBlobs.size <= PageAudioInterceptor.MAX_STORED_BLOBS) {
      return;
    }
    const oldestKey = this.capturedBlobs.keys().next().value;
    if (oldestKey) {
      this.capturedBlobs.delete(oldestKey);
    }
  }

  private listenForAudioRequests(): void {
    window.addEventListener('wgt-request-audio', async (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail || {};
      const { requestId, url } = detail;

      if (!requestId || !url) {
        return;
      }

      try {
        const dataUrl = await this.resolveAudioAsDataUrl(url);
        window.dispatchEvent(
          new CustomEvent('wgt-response-audio', {
            detail: { requestId, dataUrl },
          })
        );
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        window.dispatchEvent(
          new CustomEvent('wgt-response-audio', {
            detail: { requestId, error: errorMessage },
          })
        );
      }
    });
  }

  private async resolveAudioAsDataUrl(url: string): Promise<string> {
    const stored = this.capturedBlobs.get(url);
    if (stored) {
      return this.blobToDataUrl(stored.blob);
    }

    const response = await fetch(url);
    const blob = await response.blob();
    return this.blobToDataUrl(blob);
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Falha ao converter Blob para Data URL.'));
      reader.readAsDataURL(blob);
    });
  }

  private isAudioBlob(blob: Blob): boolean {
    const type = blob.type.toLowerCase();
    return type.startsWith('audio/') || type.includes('ogg') || type.includes('opus') || type.includes('webm');
  }

  private isAudioNetworkUrl(url: string): boolean {
    if (!url || url.includes('dit.whatsapp.net') || url.includes('telemetry')) {
      return false;
    }
    const lower = url.toLowerCase();
    return lower.includes('.ogg') || lower.includes('.opus') || lower.includes('.mp3') || lower.includes('audio');
  }
}
