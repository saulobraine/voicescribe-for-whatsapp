import { ChromeStorageGateway } from '../infrastructure/ChromeStorageGateway.js';

export interface AutoTranscribeTask {
  messageElement: HTMLElement;
  targetElement: HTMLElement;
  button: HTMLButtonElement;
  container: HTMLElement;
  audioId: string;
}

export type AutoTranscribeExecutor = (task: AutoTranscribeTask) => Promise<void>;

export class AutoTranscribeQueue {
  private static readonly DEFAULT_THROTTLE_MS = 1000;

  private readonly storage: ChromeStorageGateway;
  private readonly executor: AutoTranscribeExecutor;
  private readonly throttleDelayMs: number;

  private queue: AutoTranscribeTask[] = [];
  private isProcessing: boolean = false;
  private isEnabled: boolean = false;
  private pausedUntilTimestamp: number = 0;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    storage: ChromeStorageGateway = new ChromeStorageGateway(),
    executor: AutoTranscribeExecutor,
    throttleDelayMs: number = AutoTranscribeQueue.DEFAULT_THROTTLE_MS
  ) {
    this.storage = storage;
    this.executor = executor;
    this.throttleDelayMs = throttleDelayMs;
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.clear();
      return;
    }
    void this.processNext();
  }

  public isAutoEnabled(): boolean {
    return this.isEnabled;
  }

  public enqueue(task: AutoTranscribeTask): void {
    if (!this.isEnabled) {
      return;
    }
    if (!this.isDomConnected(task)) {
      return;
    }
    if (this.isAlreadyQueued(task)) {
      return;
    }
    this.queue.push(task);
    void this.processNext();
  }

  public pause(delayMs: number): void {
    this.pauseUntil(Date.now() + delayMs);
  }

  public pauseUntil(resetTimestamp: number): void {
    this.pausedUntilTimestamp = resetTimestamp;
    const delayMs = Math.max(1000, resetTimestamp - Date.now());
    this.scheduleResume(delayMs);
  }

  public resume(): void {
    this.clearPauseTimer();
    this.pausedUntilTimestamp = 0;
    void this.processNext();
  }

  public isPaused(): boolean {
    return this.pausedUntilTimestamp > Date.now();
  }

  public size(): number {
    return this.queue.length;
  }

  public clear(): void {
    this.queue = [];
    this.clearPauseTimer();
    this.pausedUntilTimestamp = 0;
  }

  public isBusy(): boolean {
    return this.isProcessing;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing) {
      return;
    }
    if (!this.isEnabled) {
      return;
    }
    if (this.isPaused()) {
      return;
    }
    if (this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift();
    if (!task) {
      this.isProcessing = false;
      return;
    }

    try {
      const executed = await this.executeTaskWithGuard(task);
      await this.throttleIfExecuted(executed);
    } finally {
      this.isProcessing = false;
    }
    void this.processNext();
  }

  private async throttleIfExecuted(executed: boolean): Promise<void> {
    if (!executed) {
      return;
    }
    await this.waitForThrottle();
  }

  private async executeTaskWithGuard(task: AutoTranscribeTask): Promise<boolean> {
    const shouldSkip = await this.shouldSkipTask(task);
    if (shouldSkip) {
      return false;
    }
    try {
      await this.executor(task);
    } catch (error: unknown) {
      this.handleExecutionError(error, task);
    }
    return true;
  }

  private async shouldSkipTask(task: AutoTranscribeTask): Promise<boolean> {
    if (!this.isDomConnected(task)) {
      return true;
    }
    if (this.hasTerminalError(task)) {
      return true;
    }
    if (this.isAlreadyTranscribed(task)) {
      return true;
    }
    return this.isCached(task);
  }

  private isDomConnected(task: AutoTranscribeTask): boolean {
    return task.messageElement.isConnected && task.button.isConnected;
  }

  private isAlreadyTranscribed(task: AutoTranscribeTask): boolean {
    if (task.button.textContent?.includes('Transcrito')) {
      return true;
    }
    if (task.button.textContent?.includes('Cache')) {
      return true;
    }
    return Boolean(task.container.querySelector('.vs-bubble:not(.vs-error)'));
  }

  private hasTerminalError(task: AutoTranscribeTask): boolean {
    if (task.messageElement.dataset.vsTerminalError === 'true' || task.messageElement.dataset.wgtTerminalError === 'true') {
      return true;
    }
    if (task.button.dataset.vsTerminalError === 'true' || task.button.dataset.wgtTerminalError === 'true') {
      return true;
    }
    return task.button.textContent?.includes('✕ Erro') ?? false;
  }

  private async isCached(task: AutoTranscribeTask): Promise<boolean> {
    if (!task.audioId) {
      return false;
    }
    const cached = await this.storage.getCachedTranscription(task.audioId);
    return Boolean(cached);
  }

  private isAlreadyQueued(task: AutoTranscribeTask): boolean {
    return this.queue.some((queuedItem) => {
      if (task.audioId && queuedItem.audioId) {
        return queuedItem.audioId === task.audioId;
      }
      return queuedItem.messageElement === task.messageElement;
    });
  }

  private handleExecutionError(error: unknown, task: AutoTranscribeTask): void {
    const message = error instanceof Error ? error.message : String(error);
    if (this.isRateLimitMessage(message)) {
      const resetTimestamp = this.parseResetTimestamp(message);
      this.queue.unshift(task);
      this.pauseUntil(resetTimestamp);
      return;
    }
    this.markTerminalError(task);
  }

  private isRateLimitMessage(message: string): boolean {
    const lower = message.toLowerCase();
    return (
      lower.includes('limite da api') ||
      lower.includes('cota') ||
      lower.includes('quota') ||
      lower.includes('rate limit') ||
      lower.includes('429')
    );
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
    return target.getTime() > now.getTime() ? target.getTime() : Date.now() + 5000;
  }

  private markTerminalError(task: AutoTranscribeTask): void {
    task.messageElement.dataset.vsTerminalError = 'true';
    task.button.dataset.vsTerminalError = 'true';
  }

  private scheduleResume(delayMs: number): void {
    this.clearPauseTimer();
    this.pauseTimer = setTimeout(() => {
      this.resume();
    }, delayMs);
  }

  private clearPauseTimer(): void {
    if (!this.pauseTimer) {
      return;
    }
    clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
  }

  private waitForThrottle(): Promise<void> {
    if (this.throttleDelayMs <= 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => setTimeout(resolve, this.throttleDelayMs));
  }
}
