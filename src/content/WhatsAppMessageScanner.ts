import { TranscriptionUiFactory } from './TranscriptionUiFactory.js';
import { WhatsAppAudioCapturer } from './WhatsAppAudioCapturer.js';
import { ChromeStorageGateway } from '../infrastructure/ChromeStorageGateway.js';
import { AutoTranscribeQueue, AutoTranscribeTask } from './AutoTranscribeQueue.js';
import { MessageAgeValidator } from './MessageAgeValidator.js';

interface PendingObservedMessage {
  targetElement: HTMLElement;
  button: HTMLButtonElement;
  container?: HTMLElement;
}

export class WhatsAppMessageScanner {
  private readonly uiFactory: TranscriptionUiFactory;
  private readonly audioCapturer: WhatsAppAudioCapturer;
  private readonly storage: ChromeStorageGateway;
  private readonly autoTranscribeQueue: AutoTranscribeQueue;
  private readonly ageValidator: MessageAgeValidator;
  private readonly visibilityObserver: IntersectionObserver | null;
  private readonly pendingObservedMessages = new Map<HTMLElement, PendingObservedMessage>();

  constructor(
    uiFactory: TranscriptionUiFactory = new TranscriptionUiFactory(),
    audioCapturer: WhatsAppAudioCapturer = new WhatsAppAudioCapturer(),
    storage: ChromeStorageGateway = new ChromeStorageGateway(),
    autoTranscribeQueue?: AutoTranscribeQueue,
    ageValidator: MessageAgeValidator = new MessageAgeValidator(),
    visibilityObserver?: IntersectionObserver | null
  ) {
    this.uiFactory = uiFactory;
    this.audioCapturer = audioCapturer;
    this.storage = storage;
    this.ageValidator = ageValidator;
    this.autoTranscribeQueue =
      autoTranscribeQueue ||
      new AutoTranscribeQueue(this.storage, (task) => this.executeAutoTranscription(task));
    this.visibilityObserver =
      visibilityObserver !== undefined ? visibilityObserver : this.createVisibilityObserver();
  }

  private createVisibilityObserver(): IntersectionObserver | null {
    if (typeof IntersectionObserver === 'undefined') {
      return null;
    }
    return new IntersectionObserver((entries) => {
      this.handleVisibilityEntries(entries);
    }, {
      root: null,
      threshold: 0.1,
    });
  }

  private handleVisibilityEntries(entries: IntersectionObserverEntry[]): void {
    entries.forEach((entry) => {
      this.handleVisibilityEntry(entry);
    });
  }

  private handleVisibilityEntry(entry: IntersectionObserverEntry): void {
    if (!entry.isIntersecting) {
      return;
    }
    const messageElement = entry.target as HTMLElement;
    this.visibilityObserver?.unobserve(messageElement);
    const pending = this.pendingObservedMessages.get(messageElement);
    this.pendingObservedMessages.delete(messageElement);
    if (!pending) {
      return;
    }
    this.enqueueIfAutoTranscribeEligible(
      messageElement,
      pending.targetElement,
      pending.button,
      pending.container
    );
  }

  public start(): void {
    this.uiFactory.injectStyles();
    this.injectNetworkInterceptor();
    void this.initAutoTranscribe();
    this.scan();
    this.observeMutations();
    this.observeScroll();
    this.startHeartbeat();
    this.listenStorageChanges();
  }

  private async initAutoTranscribe(): Promise<void> {
    const isAuto = await this.storage.isAutoTranscribeEnabled();
    this.autoTranscribeQueue.setEnabled(isAuto);
    if (isAuto) {
      this.scan();
    }
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
      if (!message || processedMessages.has(message)) {
        continue;
      }
      processedMessages.add(message);

      const existingButton = message.querySelector<HTMLButtonElement>('.wgt-transcribe-button');
      if (existingButton) {
        this.queueOrObserveMessage(message, candidate, existingButton);
        continue;
      }
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
    const button = this.uiFactory.createTranscribeButton((btn) => {
      void this.onTranscribeClick(messageElement, targetElement, btn, container);
    });
    container.appendChild(button);
    void this.checkCachedTranscription(messageElement, button, container);
    this.queueOrObserveMessage(messageElement, targetElement, button, container);
  }

  private queueOrObserveMessage(
    messageElement: HTMLElement,
    targetElement: HTMLElement,
    button: HTMLButtonElement,
    existingContainer?: HTMLElement
  ): void {
    if (!this.autoTranscribeQueue.isAutoEnabled()) {
      return;
    }
    if (messageElement.dataset.wgtAutoQueued === 'true') {
      return;
    }
    if (!this.ageValidator.isWithinLast24Hours(messageElement)) {
      return;
    }
    if (!this.visibilityObserver) {
      this.enqueueIfAutoTranscribeEligible(messageElement, targetElement, button, existingContainer);
      return;
    }
    this.pendingObservedMessages.set(messageElement, {
      targetElement,
      button,
      container: existingContainer,
    });
    this.visibilityObserver.observe(messageElement);
  }

  private enqueueIfAutoTranscribeEligible(
    messageElement: HTMLElement,
    targetElement: HTMLElement,
    button: HTMLButtonElement,
    existingContainer?: HTMLElement
  ): void {
    if (!this.autoTranscribeQueue.isAutoEnabled()) {
      return;
    }
    if (messageElement.dataset.wgtAutoQueued === 'true') {
      return;
    }
    messageElement.dataset.wgtAutoQueued = 'true';
    const container = existingContainer || this.uiFactory.getOrCreateContainer(messageElement, targetElement);
    const audioId = this.extractMessageIdentifier(messageElement);
    const task: AutoTranscribeTask = {
      messageElement,
      targetElement,
      button,
      container,
      audioId,
    };
    this.autoTranscribeQueue.enqueue(task);
  }

  private async executeAutoTranscription(task: AutoTranscribeTask): Promise<void> {
    const cached = await this.storage.getCachedTranscription(task.audioId);
    if (cached) {
      this.toggleCachedBubble(task.messageElement, task.container, cached, task.button);
      return;
    }
    await this.transcribeAudioMessage(
      task.messageElement,
      task.targetElement,
      task.button,
      task.container,
      task.audioId
    );
  }

  private async onTranscribeClick(
    messageElement: HTMLElement,
    targetElement: HTMLElement,
    button: HTMLButtonElement,
    container: HTMLElement
  ): Promise<void> {
    messageElement.dataset.wgtAutoQueued = 'true';
    const audioId = this.extractMessageIdentifier(messageElement);
    const cached = await this.storage.getCachedTranscription(audioId);

    if (cached) {
      this.toggleCachedBubble(messageElement, container, cached, button);
      return;
    }

    try {
      await this.transcribeAudioMessage(messageElement, targetElement, button, container, audioId);
    } catch {
      // Erro tratado visualmente pelo handleTranscriptionError
    }
  }

  private async transcribeAudioMessage(
    messageElement: HTMLElement,
    targetElement: HTMLElement,
    button: HTMLButtonElement,
    container: HTMLElement,
    audioId: string
  ): Promise<void> {
    messageElement.dataset.wgtAutoQueued = 'true';
    button.disabled = true;
    button.textContent = '⏳ Transcrevendo...';
    this.uiFactory.clearBubbles(container);

    try {
      const audioDataUrl = await this.audioCapturer.captureAudioDataUrl(messageElement, targetElement);
      const resultText = await this.sendToBackgroundForTranscription(audioDataUrl);

      button.textContent = '✓ Transcrito';
      if (audioId) {
        await this.storage.saveCachedTranscription(audioId, resultText);
      }
      delete messageElement.dataset.wgtClosed;
      this.uiFactory.renderBubble(container, resultText, false, () => {
        messageElement.dataset.wgtClosed = 'true';
      });
    } catch (error: unknown) {
      this.handleTranscriptionError(error, button, container, messageElement);
      throw error;
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
    messageElement.dataset.wgtAutoQueued = 'true';
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
    const isQuota = message.includes('Limite da API') || message.includes('cota') || message.includes('quota') || message.includes('rate limit');

    if (isQuota) {
      this.startCooldownAutoCountdown(button, container, messageElement, message);
      this.uiFactory.renderBubble(container, `${message}\n\nDica: você pode adicionar novas chaves em Opções.`, false, () => {
        messageElement.dataset.wgtClosed = 'true';
      });
      return;
    }

    button.textContent = '✕ Erro';
    button.disabled = false;
    this.uiFactory.renderBubble(container, message || 'Falha na transcrição.', true, () => {
      messageElement.dataset.wgtClosed = 'true';
    });
  }

  private startCooldownAutoCountdown(
    button: HTMLButtonElement,
    container: HTMLElement,
    messageElement: HTMLElement,
    errorMessage: string
  ): void {
    this.clearButtonCooldownTimer(button);
    button.disabled = true;

    const targetTimestamp = this.parseResetTimestamp(errorMessage);
    const initialSeconds = Math.max(1, Math.ceil((targetTimestamp - Date.now()) / 1000));
    button.textContent = `🕐 Cooldown (${initialSeconds}s)`;

    const timer = setInterval(() => {
      const remainingSeconds = Math.max(0, Math.ceil((targetTimestamp - Date.now()) / 1000));

      if (!button.isConnected) {
        clearInterval(timer);
        return;
      }

      if (remainingSeconds <= 0) {
        clearInterval(timer);
        this.clearButtonCooldownTimer(button);
        void this.restoreButtonToReady(button, messageElement, container);
        return;
      }

      button.textContent = `🕐 Cooldown (${remainingSeconds}s)`;
    }, 1000);

    (button as any)._wgtCooldownTimer = timer;
  }

  private parseResetTimestamp(errorMessage: string): number {
    const timeMatch = errorMessage.match(/(\d{1,2}):(\d{2}):(\d{2})/);
    if (!timeMatch) {
      return Date.now() + 15000;
    }

    const now = new Date();
    const hours = parseInt(timeMatch[1] || '0', 10);
    const minutes = parseInt(timeMatch[2] || '0', 10);
    const seconds = parseInt(timeMatch[3] || '0', 10);

    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds);
    if (target.getTime() < now.getTime() - 10000) {
      target.setDate(target.getDate() + 1);
    }

    if (target.getTime() > now.getTime()) {
      return target.getTime();
    }
    return Date.now() + 5000;
  }

  private clearButtonCooldownTimer(button: HTMLButtonElement): void {
    const timer = (button as any)._wgtCooldownTimer;
    if (timer) {
      clearInterval(timer);
      delete (button as any)._wgtCooldownTimer;
    }
  }

  private async restoreButtonToReady(
    button: HTMLButtonElement,
    messageElement: HTMLElement,
    container?: HTMLElement
  ): Promise<void> {
    this.clearButtonCooldownTimer(button);
    button.disabled = false;
    const audioId = this.extractMessageIdentifier(messageElement);
    const cached = await this.storage.getCachedTranscription(audioId);

    if (button.isConnected) {
      button.textContent = cached ? '✓ Cache' : '🎙 Transcrever';
    }

    if (container) {
      const bubble = container.querySelector('.wgt-bubble');
      if (bubble && bubble.textContent?.includes('Limite da API')) {
        bubble.remove();
      }
    }
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

  private listenStorageChanges(): void {
    chrome.storage?.onChanged?.addListener((changes, area) => {
      if (area === 'local' && changes.geminiKeys) {
        void this.checkAndRestoreAvailableKeys();
      }
      if (area === 'local' && changes.auto_transcribe_enabled) {
        const isEnabled = Boolean(changes.auto_transcribe_enabled.newValue);
        this.autoTranscribeQueue.setEnabled(isEnabled);
        if (isEnabled) {
          this.scan();
        }
      }
    });
  }

  private async checkAndRestoreAvailableKeys(): Promise<void> {
    const records = await this.storage.getStoredKeys();
    const now = Date.now();
    const hasAvailableKey = records.some((r) => r.active && (!r.rateLimitReset || r.rateLimitReset <= now));
    if (hasAvailableKey) {
      this.restoreAllCooldownButtons();
      this.autoTranscribeQueue.resume();
    }
  }

  private restoreAllCooldownButtons(): void {
    const buttons = document.querySelectorAll<HTMLButtonElement>('.wgt-transcribe-button');
    buttons.forEach((button) => {
      if (button.textContent?.includes('Cooldown')) {
        this.clearButtonCooldownTimer(button);
        button.disabled = false;
        button.textContent = '🎙 Transcrever';
        const container = button.closest<HTMLElement>('.wgt-container');
        const bubble = container?.querySelector('.wgt-bubble');
        if (bubble && bubble.textContent?.includes('Limite da API')) {
          bubble.remove();
        }
      }
    });
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
    if (this.isSpecificMessageId(dataId)) {
      return dataId;
    }
    const testId = messageElement.getAttribute('data-testid') || '';
    const cleaned = testId.replace(/^conv-msg-/, '');
    if (this.isSpecificMessageId(cleaned)) {
      return cleaned;
    }
    return '';
  }

  private isSpecificMessageId(id: string): boolean {
    if (!id || typeof id !== 'string') {
      return false;
    }
    if (['main', 'pane-side', 'chat-list', 'app'].includes(id)) {
      return false;
    }
    const parts = id.split('_');
    if (parts.length >= 3 && parts[parts.length - 1].length >= 4) {
      return true;
    }
    if (parts.length >= 2 && id.includes('@') && parts[parts.length - 1].length >= 6) {
      return true;
    }
    return /^[0-9A-Za-z]{16,}$/.test(id);
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
    setInterval(() => {
      this.scan();
      void this.checkAndRestoreAvailableKeys();
    }, 2000);
  }

  public injectNetworkInterceptor(): void {
    if (document.getElementById('wgt-interceptor')) {
      return;
    }
    const script = document.createElement('script');
    script.id = 'wgt-interceptor';
    script.src = chrome.runtime.getURL('interceptor.js');
    (document.head || document.documentElement).appendChild(script);
  }
}
