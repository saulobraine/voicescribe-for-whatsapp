/**
 * Interceptor de rede e mídias de áudio injetado no contexto nativo (page context) do WhatsApp Web.
 * Segue regras de Object Calisthenics: 1 nível de indentação por método, sem else, métodos concisos.
 */
export class PageAudioInterceptor {
  private static readonly MAX_STORED_BLOBS = 50;
  private readonly blobStore: Map<string, Blob & { __wgtTimestamp?: number }>;
  private isSilentCaptureActive = false;
  private silentCaptureTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const globalWindow = window as unknown as {
      __wgtBlobStore?: Map<string, Blob & { __wgtTimestamp?: number }>;
    };
    globalWindow.__wgtBlobStore = globalWindow.__wgtBlobStore || new Map();
    this.blobStore = globalWindow.__wgtBlobStore;
  }

  public start(): void {
    const globalWindow = window as unknown as { __wgtInterceptorInstalled?: boolean };
    if (globalWindow.__wgtInterceptorInstalled) {
      return;
    }
    globalWindow.__wgtInterceptorInstalled = true;

    this.listenForSilentCapture();
    this.interceptMediaPlay();
    this.observeDynamicMedia();
    this.interceptCreateObjectURL();
    this.interceptRevokeObjectURL();
    this.interceptFetch();
    this.interceptXmlHttpRequest();
    this.listenForAudioRequests();
  }

  private listenForSilentCapture(): void {
    window.addEventListener('wgt-silent-capture-start', () => {
      this.handleSilentCaptureStart();
    });

    window.addEventListener('wgt-silent-capture-stop', () => {
      this.handleSilentCaptureStop();
    });
  }

  private handleSilentCaptureStart(): void {
    this.isSilentCaptureActive = true;
    if (this.silentCaptureTimer) {
      clearTimeout(this.silentCaptureTimer);
    }
    this.silentCaptureTimer = setTimeout(() => {
      this.isSilentCaptureActive = false;
    }, 30000);

    const mediaElements = document.querySelectorAll<HTMLMediaElement>('audio, video');
    mediaElements.forEach((element) => this.muteElement(element));
  }

  private handleSilentCaptureStop(): void {
    this.isSilentCaptureActive = false;
    if (this.silentCaptureTimer) {
      clearTimeout(this.silentCaptureTimer);
    }

    const mediaElements = document.querySelectorAll<HTMLMediaElement>('audio, video');
    mediaElements.forEach((element) => this.restoreElement(element));
  }

  private muteElement(element: HTMLMediaElement): void {
    try {
      element.muted = true;
      element.volume = 0;
    } catch {
      // Ignora erro de mutar elemento
    }
  }

  private restoreElement(element: HTMLMediaElement): void {
    try {
      if (element.paused) {
        element.muted = false;
        element.volume = 1;
        return;
      }
      element.pause();
      element.currentTime = 0;
      setTimeout(() => {
        try {
          element.muted = false;
          element.volume = 1;
        } catch {}
      }, 300);
    } catch {
      // Ignora erro de restaurar elemento
    }
  }

  private interceptMediaPlay(): void {
    const originalPlay = HTMLMediaElement.prototype.play;
    const self = this;

    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement): Promise<void> {
      self.notifyAudioPlay(this);
      self.applyPlaybackVolumePolicy(this);
      return originalPlay.apply(this);
    };
  }

  private notifyAudioPlay(element: HTMLMediaElement): void {
    const audioUrl = element.currentSrc || element.src;
    if (!audioUrl) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent('wgt-audio', {
        detail: { url: audioUrl, timestamp: Date.now() },
      })
    );
  }

  private applyPlaybackVolumePolicy(element: HTMLMediaElement): void {
    if (this.isSilentCaptureActive) {
      this.muteElement(element);
      return;
    }
    if (element.muted && element.volume === 0) {
      element.muted = false;
      element.volume = 1;
    }
  }

  private observeDynamicMedia(): void {
    const mediaObserver = new MutationObserver(() => {
      if (!this.isSilentCaptureActive) {
        return;
      }
      const mediaElements = document.querySelectorAll<HTMLMediaElement>('audio, video');
      mediaElements.forEach((element) => this.muteElement(element));
    });
    mediaObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  private interceptCreateObjectURL(): void {
    const originalCreate = URL.createObjectURL.bind(URL);
    const self = this;

    URL.createObjectURL = function (object: Blob | MediaSource): string {
      const url = originalCreate(object);
      if (object instanceof Blob && self.isAudioOrVideoBlob(object)) {
        self.registerAudioBlob(url, object);
      }
      self.emitAudioUrlIfInteresting(url, object instanceof Blob ? object.type : '');
      return url;
    };
  }

  private interceptRevokeObjectURL(): void {
    const originalRevoke = URL.revokeObjectURL.bind(URL);
    const self = this;

    URL.revokeObjectURL = function (url: string): void {
      setTimeout(() => {
        self.blobStore.delete(url);
      }, 120000);
      return originalRevoke(url);
    };
  }

  private interceptFetch(): void {
    const originalFetch = window.fetch.bind(window);
    const self = this;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const response = await originalFetch(input, init);
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      self.emitAudioUrlIfInteresting(url);
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
      this.addEventListener('load', () => {
        const contentType = this.getResponseHeader('Content-Type') || '';
        self.emitAudioUrlIfInteresting(url, contentType);
      });
      return originalSend.apply(this, [body]);
    };
  }

  private emitAudioUrlIfInteresting(url: string, type: string = ''): void {
    if (!url || typeof url !== 'string') {
      return;
    }
    if (url.includes('telemetry') || url.includes('dit.whatsapp.net') || url.includes('image')) {
      return;
    }
    const lower = url.toLowerCase();
    const isInteresting =
      lower.includes('mmg.whatsapp.net') ||
      /\.(ogg|opus|mp4)(?:[?#]|$)/i.test(lower) ||
      lower.includes('/media/') ||
      this.isAudioOrVideoType(type);

    if (!isInteresting) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent('wgt-audio', {
        detail: { url, type, timestamp: Date.now() },
      })
    );
  }

  private registerAudioBlob(url: string, blob: Blob & { __wgtTimestamp?: number }): void {
    blob.__wgtTimestamp = Date.now();
    this.blobStore.set(url, blob);
    this.pruneOldBlobs();

    window.dispatchEvent(
      new CustomEvent('wgt-audio', {
        detail: { url, timestamp: blob.__wgtTimestamp, blob },
      })
    );
  }

  private pruneOldBlobs(): void {
    if (this.blobStore.size <= PageAudioInterceptor.MAX_STORED_BLOBS) {
      return;
    }
    const oldestKey = this.blobStore.keys().next().value;
    if (oldestKey) {
      this.blobStore.delete(oldestKey);
    }
  }

  private listenForAudioRequests(): void {
    window.addEventListener('wgt-request-audio', async (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail || {};
      const { requestId, url, minTimestamp, messageId, filehash } = detail;

      if (!requestId) {
        return;
      }

      try {
        const blob = await this.resolveBlob(url, minTimestamp, filehash, messageId);
        if (!blob) {
          this.respondAudioError(requestId, 'Áudio não encontrado no contexto da página.');
          return;
        }
        await this.respondAudioBlobAsDataUrl(requestId, blob);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.respondAudioError(requestId, errorMessage);
      }
    });
  }

  private async resolveBlob(
    url?: string,
    minTimestamp?: number,
    filehash?: string,
    messageId?: string
  ): Promise<Blob | null> {
    const memoryBlob = await this.tryResolveFromWhatsAppMediaCache(filehash, messageId);
    if (memoryBlob) {
      return memoryBlob;
    }

    if (url) {
      const stored = this.blobStore.get(url);
      if (stored) {
        return stored;
      }
      const fetched = await this.tryFetchBlob(url);
      if (fetched) {
        return fetched;
      }
    }

    if (minTimestamp) {
      const found = this.findBestBlobByTimestamp(minTimestamp);
      if (found) {
        return found;
      }
    }

    if (!minTimestamp) {
      return this.findBlobFromDomElements();
    }

    return null;
  }

  private async tryResolveFromWhatsAppMediaCache(
    filehash?: string,
    messageId?: string
  ): Promise<Blob | null> {
    const msg = messageId ? this.findMessageModel(messageId) : null;
    const resolvedHash = filehash || msg?.filehash || msg?.mediaData?.filehash || null;
    const cache = this.getInMemoryMediaBlobCache();

    if (resolvedHash && cache) {
      const existingBlob = await this.resolveBlobFromCache(cache, resolvedHash);
      if (existingBlob) {
        return existingBlob;
      }
    }

    if (msg) {
      return this.downloadAndPollDecryptedBlob(msg, resolvedHash, cache);
    }

    return null;
  }

  private findMessageModel(messageId: string): any {
    const win = window as any;
    const collections = this.safeRequireModule(win.require, 'WAWebCollections');
    const msgCollection = this.safeRequireModule(win.require, 'WAWebMsgCollection');
    const Msg = collections?.Msg || msgCollection?.MsgCollection || null;
    if (!Msg) {
      return null;
    }
    if (Array.isArray(Msg._models)) {
      const found = Msg._models.find((item: any) => {
        const itemId = item.id?.id || item.id?._serialized || item.id;
        return itemId === messageId || String(itemId).includes(messageId) || messageId.includes(String(itemId));
      });
      if (found) {
        return found;
      }
    }
    return Msg.get?.(messageId) || null;
  }

  private getInMemoryMediaBlobCache(): any {
    const win = window as any;
    if (typeof win.require !== 'function') {
      return null;
    }
    const moduleItem = this.safeRequireModule(win.require, 'WAWebMediaInMemoryBlobCache');
    return moduleItem?.InMemoryMediaBlobCache || moduleItem || null;
  }

  private async resolveBlobFromCache(cache: any, filehash: string): Promise<Blob | null> {
    try {
      const directBlob = cache.get?.(filehash);
      if (directBlob instanceof Blob) {
        return directBlob;
      }
      const blobUrl = cache.getOrCreateURL?.(filehash);
      if (typeof blobUrl === 'string' && blobUrl.startsWith('blob:')) {
        return await this.tryFetchBlob(blobUrl);
      }
      return null;
    } catch {
      return null;
    }
  }

  private async downloadAndPollDecryptedBlob(
    msg: any,
    filehash: string | null,
    cache: any
  ): Promise<Blob | null> {
    this.triggerWhatsAppMediaDownload(msg);
    return this.pollForDecryptedBlob(msg, filehash, cache);
  }

  private triggerWhatsAppMediaDownload(msg: any): void {
    if (typeof msg.downloadMedia !== 'function') {
      return;
    }
    try {
      msg.downloadMedia({
        downloadEvenIfExpensive: true,
        rmrReason: 1,
        isUserInitiated: true,
      });
    } catch {
      // Ignora erro de disparo do download nativo
    }
  }

  private async pollForDecryptedBlob(
    msg: any,
    filehash: string | null,
    cache: any
  ): Promise<Blob | null> {
    for (let index = 0; index < 20; index++) {
      await this.sleep(150);
      const activeHash = filehash || msg.filehash || msg.mediaData?.filehash;
      if (activeHash && cache) {
        const blobFromCache = await this.resolveBlobFromCache(cache, activeHash);
        if (blobFromCache) {
          return blobFromCache;
        }
      }
      const mediaBlob = msg.mediaData?.mediaBlob;
      if (mediaBlob instanceof Blob) {
        return mediaBlob;
      }
    }
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private safeRequireModule(requireFn: any, moduleName: string): any {
    if (typeof requireFn !== 'function') {
      return null;
    }
    try {
      return requireFn(moduleName);
    } catch {
      return null;
    }
  }

  private async tryFetchBlob(url: string): Promise<Blob | null> {
    if (url.includes('.enc') || (url.includes('whatsapp.net') && !url.startsWith('blob:'))) {
      return null;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) {
        return null;
      }
      return await res.blob();
    } catch {
      return null;
    }
  }

  private findBestBlobByTimestamp(minTimestamp: number): Blob | null {
    let bestBlob: Blob | null = null;
    let bestTime = 0;

    for (const [, blobItem] of this.blobStore.entries()) {
      const timestamp = blobItem.__wgtTimestamp || 0;
      if (timestamp >= minTimestamp && timestamp >= bestTime) {
        bestBlob = blobItem;
        bestTime = timestamp;
      }
    }

    return bestBlob;
  }

  private async findBlobFromDomElements(): Promise<Blob | null> {
    const audioElements = Array.from(document.querySelectorAll<HTMLMediaElement>('audio, video')).filter(
      (element) => element.currentSrc || element.src
    );

    for (const element of audioElements) {
      const elementUrl = element.currentSrc || element.src;
      if (!elementUrl) {
        continue;
      }
      const cached = this.blobStore.get(elementUrl);
      if (cached) {
        return cached;
      }
      const fetched = await this.tryFetchBlob(elementUrl);
      if (fetched) {
        return fetched;
      }
    }

    return null;
  }

  private respondAudioError(requestId: string, error: string): void {
    window.dispatchEvent(
      new CustomEvent('wgt-response-audio', {
        detail: { requestId, error },
      })
    );
    window.dispatchEvent(
      new CustomEvent('wgt-audio-response', {
        detail: { requestId, error },
      })
    );
  }

  private async respondAudioBlobAsDataUrl(requestId: string, blob: Blob): Promise<void> {
    const dataUrl = await this.blobToDataUrl(blob);
    window.dispatchEvent(
      new CustomEvent('wgt-response-audio', {
        detail: { requestId, dataUrl },
      })
    );
    window.dispatchEvent(
      new CustomEvent('wgt-audio-response', {
        detail: { requestId, dataUrl },
      })
    );
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Falha ao ler dados do áudio.'));
      reader.readAsDataURL(blob);
    });
  }

  private isAudioOrVideoBlob(blob: Blob): boolean {
    return this.isAudioOrVideoType(blob.type);
  }

  private isAudioOrVideoType(type?: string): boolean {
    if (!type || typeof type !== 'string') {
      return true;
    }
    const lower = type.toLowerCase();
    return (
      lower.startsWith('audio/') ||
      lower.startsWith('video/') ||
      lower.includes('ogg') ||
      lower.includes('opus') ||
      lower.includes('octet-stream')
    );
  }
}
