/**
 * Responsável por capturar o áudio de uma mensagem no WhatsApp Web.
 * Segue regras de Object Calisthenics: 1 nível de indentação por método, sem else.
 */
export class WhatsAppAudioCapturer {
  private readonly timeoutMilliseconds: number;

  constructor(timeoutMilliseconds: number = 8000) {
    this.timeoutMilliseconds = timeoutMilliseconds;
  }

  public async captureAudioDataUrl(messageElement: HTMLElement, targetElement?: HTMLElement): Promise<string> {
    const existingMedia = this.findMediaElement(messageElement, targetElement);
    const existingUrl = existingMedia?.currentSrc || existingMedia?.src || null;

    if (existingUrl) {
      const directDataUrl = await this.tryFetchOrRequestFromPage(existingUrl);
      if (directDataUrl) {
        return directDataUrl;
      }
    }

    return this.captureViaSilentPlayback(messageElement, existingMedia);
  }

  public findMediaElement(messageElement: HTMLElement, targetElement?: HTMLElement): HTMLMediaElement | null {
    if (targetElement && (targetElement instanceof HTMLAudioElement || targetElement instanceof HTMLVideoElement)) {
      return targetElement;
    }
    const mediaElements = Array.from(messageElement.querySelectorAll<HTMLMediaElement>('audio, video'));
    const mediaWithSource = mediaElements.find((element) => element.currentSrc || element.src);
    if (mediaWithSource) {
      return mediaWithSource;
    }
    return mediaElements[0] || null;
  }

  private async tryFetchOrRequestFromPage(url: string): Promise<string | null> {
    if (!url.startsWith('blob:')) {
      try {
        return await this.fetchAsDataUrl(url);
      } catch {
        // Fallback para requisição no contexto da página
      }
    }
    try {
      return await this.requestAudioFromPage(url);
    } catch {
      return null;
    }
  }

  private async captureViaSilentPlayback(
    messageElement: HTMLElement,
    mediaElement: HTMLMediaElement | null
  ): Promise<string> {
    const startTime = Date.now();
    let capturedUrl: string | null = null;

    const audioListener = (event: CustomEvent) => {
      const detail = event.detail || {};
      if (detail.url && (!detail.timestamp || detail.timestamp >= startTime)) {
        capturedUrl = detail.url;
      }
    };

    window.addEventListener('wgt-audio', audioListener as EventListener);

    try {
      window.dispatchEvent(new CustomEvent('wgt-silent-capture-start'));
      this.muteInitialMedia(mediaElement);
      this.triggerPlay(messageElement);

      const polledDataUrl = await this.pollForAudio(messageElement, () => capturedUrl);
      if (polledDataUrl) {
        return polledDataUrl;
      }

      const fallbackDataUrl = await this.tryFallbackTimestampRequest(startTime);
      if (fallbackDataUrl) {
        return fallbackDataUrl;
      }

      throw new Error('Não consegui obter o arquivo de áudio. Reproduza a mensagem e tente novamente.');
    } finally {
      window.removeEventListener('wgt-audio', audioListener as EventListener);
      await this.cleanupSilentPlayback(messageElement, mediaElement);
    }
  }

  private muteInitialMedia(mediaElement: HTMLMediaElement | null): void {
    if (!mediaElement) {
      return;
    }
    try {
      mediaElement.muted = true;
      mediaElement.volume = 0;
    } catch {
      // Ignora erro ao mutar mídia
    }
  }

  private triggerPlay(messageElement: HTMLElement): void {
    const playButton = this.findPlayButton(messageElement);
    if (playButton) {
      playButton.click();
    }
  }

  private async pollForAudio(
    messageElement: HTMLElement,
    getCapturedUrl: () => string | null
  ): Promise<string | null> {
    for (let iteration = 0; iteration < 30; iteration++) {
      await this.sleep(200);

      const urlFromEvent = getCapturedUrl();
      if (urlFromEvent) {
        const resultFromEvent = await this.tryRequestUrl(urlFromEvent);
        if (resultFromEvent) {
          return resultFromEvent;
        }
      }

      const resultFromMedia = await this.tryExtractFromMediaElement(messageElement);
      if (resultFromMedia) {
        return resultFromMedia;
      }
    }

    return null;
  }

  private async tryRequestUrl(url: string): Promise<string | null> {
    try {
      return await this.requestAudioFromPage(url);
    } catch {
      return null;
    }
  }

  private async tryExtractFromMediaElement(messageElement: HTMLElement): Promise<string | null> {
    const media = this.findMediaElement(messageElement);
    const mediaUrl = media?.currentSrc || media?.src || null;
    if (!mediaUrl) {
      return null;
    }

    try {
      if (media) {
        media.muted = true;
        media.volume = 0;
        media.pause();
        media.currentTime = 0;
      }
      return await this.requestAudioFromPage(mediaUrl);
    } catch {
      return null;
    }
  }

  private async tryFallbackTimestampRequest(startTime: number): Promise<string | null> {
    try {
      return await this.requestAudioFromPage(null, startTime);
    } catch {
      return null;
    }
  }

  private async cleanupSilentPlayback(
    messageElement: HTMLElement,
    mediaElement: HTMLMediaElement | null
  ): Promise<void> {
    const pauseButton = this.findPauseButton(messageElement);
    if (pauseButton) {
      try {
        pauseButton.click();
      } catch {}
      await this.sleep(50);
    }

    const currentMedia = this.findMediaElement(messageElement) || mediaElement;
    if (currentMedia && !currentMedia.paused) {
      try {
        currentMedia.pause();
        currentMedia.currentTime = 0;
      } catch {}
    }

    window.dispatchEvent(new CustomEvent('wgt-silent-capture-stop'));
    this.restoreDocumentMediaVolume();
  }

  private restoreDocumentMediaVolume(): void {
    const elements = document.querySelectorAll<HTMLMediaElement>('audio, video');
    elements.forEach((element) => {
      try {
        element.muted = false;
        element.volume = 1;
      } catch {}
    });
  }

  public findPlayButton(messageElement: HTMLElement): HTMLElement | null {
    const specific = messageElement.querySelector<HTMLElement>(
      '[data-testid="audio-play"], [data-testid="ptt-play"], [data-testid="play"], ' +
      '[data-icon="audio-play"], [data-icon="audio-play-filled"], [data-icon="play"], ' +
      'button[aria-label*="Reproduzir" i], button[aria-label*="Play" i], ' +
      '[aria-label*="Reproduzir" i], [aria-label*="Play" i]'
    );
    if (specific) {
      return specific;
    }

    const playerWrapper = messageElement.querySelector<HTMLElement>(
      '[data-testid*="audio"], [data-testid*="ptt"], .audio-player'
    );
    if (playerWrapper) {
      const wrapperBtn = playerWrapper.querySelector<HTMLElement>(
        'button:not(.wgt-transcribe-button):not(.wgt-copy):not(.wgt-close)'
      );
      if (wrapperBtn) {
        return wrapperBtn;
      }
    }

    const allButtons = messageElement.querySelectorAll<HTMLElement>(
      'button:not(.wgt-transcribe-button):not(.wgt-copy):not(.wgt-close)'
    );
    for (const button of allButtons) {
      if (button.querySelector('[data-icon*="play"], svg')) {
        return button;
      }
    }

    return null;
  }

  public findPauseButton(messageElement: HTMLElement): HTMLElement | null {
    const specific = messageElement.querySelector<HTMLElement>(
      '[data-testid="audio-pause"], [data-testid="ptt-pause"], [data-testid="pause"], ' +
      '[data-icon="audio-pause"], [data-icon="audio-pause-filled"], [data-icon="pause"], ' +
      'button[aria-label*="Pausar" i], button[aria-label*="Pause" i], ' +
      '[aria-label*="Pausar" i], [aria-label*="Pause" i]'
    );
    if (specific) {
      return specific;
    }
    return null;
  }

  private async requestAudioFromPage(url: string | null, minTimestamp?: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const requestId = `wgt_${Math.random().toString(36).slice(2, 9)}`;
      const timer = setTimeout(() => {
        window.removeEventListener('wgt-response-audio', handler as EventListener);
        reject(new Error('Tempo limite excedido ao capturar o áudio da página.'));
      }, this.timeoutMilliseconds);

      const handler = (event: CustomEvent) => {
        const detail = event.detail || {};
        if (detail.requestId !== requestId) {
          return;
        }
        window.removeEventListener('wgt-response-audio', handler as EventListener);
        clearTimeout(timer);

        if (detail.error) {
          reject(new Error(detail.error));
          return;
        }
        if (detail.dataUrl) {
          resolve(detail.dataUrl);
          return;
        }
        reject(new Error('Áudio vazio retornado pela página.'));
      };

      window.addEventListener('wgt-response-audio', handler as EventListener);
      window.dispatchEvent(
        new CustomEvent('wgt-request-audio', {
          detail: { requestId, url, minTimestamp },
        })
      );
    });
  }

  private async fetchAsDataUrl(url: string): Promise<string> {
    const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Não foi possível baixar o áudio (${response.status}).`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Falha ao ler áudio como Data URL.'));
      reader.readAsDataURL(blob);
    });
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
