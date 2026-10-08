import { TranscriptionUiFactory } from './TranscriptionUiFactory.js';
import { WhatsAppAudioCapturer } from './WhatsAppAudioCapturer.js';
import { ChromeStorageGateway } from '../infrastructure/ChromeStorageGateway.js';

export class WhatsAppMessageScanner {
  private readonly uiFactory: TranscriptionUiFactory;
  private readonly audioCapturer: WhatsAppAudioCapturer;
  private readonly storage: ChromeStorageGateway;

  constructor(
    uiFactory: TranscriptionUiFactory = new TranscriptionUiFactory(),
    audioCapturer: WhatsAppAudioCapturer = new WhatsAppAudioCapturer(),
    storage: ChromeStorageGateway = new ChromeStorageGateway()
  ) {
    this.uiFactory = uiFactory;
    this.audioCapturer = audioCapturer;
    this.storage = storage;
  }

  public start(): void {
    this.uiFactory.injectStyles();
    this.injectNetworkInterceptor();
    this.scan();
    this.observeMutations();
    this.observeScroll();
    this.startHeartbeat();
  }

  public scan(): void {
    this.updateExistingContainers();

    const candidates = document.querySelectorAll<HTMLElement>(
      'audio, video, ' +
      '[data-testid*="audio"], [data-testid*="ptt"], [data-testid*="voice"], ' +
      '[data-icon*="audio-play"], [data-icon*="ptt"], span.ptt-status, ' +
      'button[aria-label*="Reproduzir" i], button[aria-label*="Play" i], ' +
      '[aria-label*="Mensagem de voz" i], [aria-label*="Voice message" i], ' +
      'div[role="slider"][aria-label*="voz" i], div[role="slider"][aria-label*="voice" i]'
    );

    const processedMessages = new Set<HTMLElement>();
    for (const candidate of candidates) {
      const message = this.findMessageContainer(candidate);
      if (!message || processedMessages.has(message) || message.querySelector('.wgt-transcribe-button')) {
        continue;
      }
      processedMessages.add(message);
      this.attachTranscribeButton(message, candidate);
    }
  }

  private updateExistingContainers(): void {
    const containers = document.querySelectorAll<HTMLElement>('.wgt-container');
    containers.forEach((container) => {
      const message = this.findMessageContainer(container);
      if (!message) {
        return;
      }
      this.uiFactory.getOrCreateContainer(message);
    });
  }

  private attachTranscribeButton(messageElement: HTMLElement, targetElement: HTMLElement): void {
    const container = this.uiFactory.getOrCreateContainer(messageElement, targetElement);
    const button = this.uiFactory.createTranscribeButton((btn) => this.onTranscribeClick(messageElement, targetElement, btn, container));
    container.appendChild(button);
    void this.checkCachedTranscription(messageElement, button, container);
  }

  private async onTranscribeClick(
    messageElement: HTMLElement,
    targetElement: HTMLElement,
    button: HTMLButtonElement,
    container: HTMLElement
  ): Promise<void> {
    const audioId = this.extractMessageIdentifier(messageElement);
    const cached = await this.storage.getCachedTranscription(audioId);

    if (cached) {
      this.toggleCachedBubble(messageElement, container, cached, button);
      return;
    }

    button.disabled = true;
    button.textContent = '⏳ Transcrevendo...';
    this.uiFactory.clearBubbles(container);

    try {
      const audioDataUrl = await this.audioCapturer.captureAudioDataUrl(messageElement, targetElement);
      const resultText = await this.sendToBackgroundForTranscription(audioDataUrl);

      button.textContent = '✓ Transcrito';
      await this.storage.saveCachedTranscription(audioId, resultText);
      delete messageElement.dataset.wgtClosed;
      this.uiFactory.renderBubble(container, resultText, false, () => {
        messageElement.dataset.wgtClosed = 'true';
      });
    } catch (error: unknown) {
      this.handleTranscriptionError(error, button, container, messageElement);
    } finally {
      this.resetButtonState(button, audioId);
    }
  }

  private toggleCachedBubble(
    messageElement: HTMLElement,
    container: HTMLElement,
    cachedText: string,
    button: HTMLButtonElement
  ): void {
    button.textContent = '✓ Cache';
    const existingBubble = container.querySelector('.wgt-bubble');
    if (existingBubble) {
      existingBubble.remove();
      messageElement.dataset.wgtClosed = 'true';
      return;
    }
    delete messageElement.dataset.wgtClosed;
    this.uiFactory.renderBubble(container, cachedText, false, () => {
      messageElement.dataset.wgtClosed = 'true';
    });
  }

  private async checkCachedTranscription(
    messageElement: HTMLElement,
    button: HTMLButtonElement,
    container: HTMLElement
  ): Promise<void> {
    const audioId = this.extractMessageIdentifier(messageElement);
    const cached = await this.storage.getCachedTranscription(audioId);
    if (!cached) {
      return;
    }
    if (button.isConnected) {
      button.textContent = '✓ Cache';
      button.title = 'Transcrição em cache (clique para alternar)';
    }
    if (!container.querySelector('.wgt-bubble') && !messageElement.dataset.wgtClosed) {
      this.uiFactory.renderBubble(container, cached, false, () => {
        messageElement.dataset.wgtClosed = 'true';
      });
    }
  }

  private handleTranscriptionError(
    error: unknown,
    button: HTMLButtonElement,
    container: HTMLElement,
    messageElement: HTMLElement
  ): void {
    const message = error instanceof Error ? error.message : String(error);
    const isQuota = message.includes('Limite da API') || message.includes('cota') || message.includes('quota');
    if (isQuota) {
      button.textContent = '🕐 Cooldown';
      this.uiFactory.renderBubble(container, `${message}\n\nDica: você pode adicionar novas chaves em Opções.`, false);
      return;
    }

    button.textContent = '✕ Erro';
    this.uiFactory.renderBubble(container, message || 'Falha na transcrição.', true, () => {
      messageElement.dataset.wgtClosed = 'true';
    });
  }

  private resetButtonState(button: HTMLButtonElement, audioId: string): void {
    setTimeout(async () => {
      if (!button.isConnected || button.textContent?.includes('Cooldown')) {
        return;
      }
      button.disabled = false;
      const cached = await this.storage.getCachedTranscription(audioId);
      if (button.isConnected) {
        button.textContent = cached ? '✓ Cache' : '🎙 Transcrever';
      }
    }, 2500);
  }

  private sendToBackgroundForTranscription(audioDataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'transcribe', dataUrl: audioDataUrl }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response?.error) {
          reject(new Error(response.error));
          return;
        }
        if (typeof response?.text === 'string') {
          resolve(response.text);
          return;
        }
        reject(new Error('Resposta inválida do serviço de transcrição.'));
      });
    });
  }

  private findMessageContainer(element: HTMLElement): HTMLElement | null {
    return element.closest<HTMLElement>('[data-id]') ||
      element.closest<HTMLElement>('[data-testid^="conv-msg-"]') ||
      element.closest<HTMLElement>('[role="row"]') ||
      element.closest<HTMLElement>('.message-in, .message-out, .msg-container');
  }

  private extractMessageIdentifier(messageElement: HTMLElement): string {
    const dataId = messageElement.getAttribute('data-id') || messageElement.dataset.id || '';
    if (dataId.length > 0) {
      return dataId;
    }
    const testId = messageElement.getAttribute('data-testid') || '';
    return testId.replace(/^conv-msg-/, '');
  }

  private observeMutations(): void {
    const observer = new MutationObserver(() => this.scan());
    const target = document.body || document.documentElement;
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }
  }

  private observeScroll(): void {
    window.addEventListener('scroll', () => this.scan(), { capture: true, passive: true });
  }

  private startHeartbeat(): void {
    setInterval(() => this.scan(), 2000);
  }

  private injectNetworkInterceptor(): void {
    if (document.getElementById('wgt-interceptor')) {
      return;
    }
    const script = document.createElement('script');
    script.id = 'wgt-interceptor';
    script.src = chrome.runtime.getURL('interceptor.js');
    (document.head || document.documentElement).appendChild(script);
  }
}
