export class WhatsAppAudioCapturer {
  private readonly timeoutMilliseconds: number;

  constructor(timeoutMilliseconds: number = 8000) {
    this.timeoutMilliseconds = timeoutMilliseconds;
  }

  public async captureAudioDataUrl(messageElement: HTMLElement, targetElement?: HTMLElement): Promise<string> {
    const existingMedia = this.findMediaElement(messageElement, targetElement);
    const existingUrl = existingMedia?.currentSrc || existingMedia?.src || null;

    if (existingUrl) {
      const dataUrl = await this.tryFetchOrRequestFromPage(existingUrl);
      if (dataUrl) {
        return dataUrl;
      }
    }

    return this.captureViaSilentPlayback(messageElement, existingMedia);
  }

  private findMediaElement(messageElement: HTMLElement, targetElement?: HTMLElement): HTMLMediaElement | null {
    if (targetElement && (targetElement instanceof HTMLAudioElement || targetElement instanceof HTMLVideoElement)) {
      return targetElement;
    }
    const media = messageElement.querySelector<HTMLMediaElement>('audio, video');
    return media || null;
  }

  private async tryFetchOrRequestFromPage(url: string): Promise<string | null> {
    if (!url.startsWith('blob:')) {
      try {
        return await this.fetchAsDataUrl(url);
      } catch {
        // Fallback para requisição à página
      }
    }
    try {
      return await this.requestAudioFromPage(url);
    } catch {
      return null;
    }
  }

  private async requestAudioFromPage(url: string, minTimestamp?: number): Promise<string> {
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
      if (mediaElement) {
        mediaElement.muted = true;
        mediaElement.volume = 0;
      }

      const playButton = this.findPlayButton(messageElement);
      if (playButton) {
        playButton.click();
      }

      const deadline = Date.now() + 4000;
      while (Date.now() < deadline && !capturedUrl) {
        await this.sleep(80);
      }

      this.stopPlayback(messageElement, mediaElement);

      if (!capturedUrl) {
        throw new Error('Não foi possível obter o áudio desta mensagem.');
      }

      return await this.requestAudioFromPage(capturedUrl, startTime);
    } finally {
      window.removeEventListener('wgt-audio', audioListener as EventListener);
      window.dispatchEvent(new CustomEvent('wgt-silent-capture-stop'));
    }
  }

  private findPlayButton(messageElement: HTMLElement): HTMLButtonElement | null {
    const playButton = messageElement.querySelector<HTMLButtonElement>(
      '[data-testid="audio-play"], [data-testid="ptt-play"], ' +
      'button[aria-label*="Reproduzir" i], button[aria-label*="Play" i]'
    );
    return playButton || null;
  }

  private stopPlayback(messageElement: HTMLElement, mediaElement: HTMLMediaElement | null): void {
    if (mediaElement) {
      try {
        mediaElement.pause();
      } catch {}
    }
    const pauseButton = messageElement.querySelector<HTMLButtonElement>(
      '[data-testid="audio-pause"], [data-testid="ptt-pause"], ' +
      'button[aria-label*="Pausar" i], button[aria-label*="Pause" i]'
    );
    if (pauseButton) {
      pauseButton.click();
    }
  }

  private async fetchAsDataUrl(url: string): Promise<string> {
    const response = await fetch(url);
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
