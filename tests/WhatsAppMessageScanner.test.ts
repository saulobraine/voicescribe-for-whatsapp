import test from 'node:test';
import assert from 'node:assert/strict';
import { WhatsAppMessageScanner } from '../src/content/WhatsAppMessageScanner.js';
import { AutoTranscribeQueue } from '../src/content/AutoTranscribeQueue.js';
import { MessageAgeValidator } from '../src/content/MessageAgeValidator.js';

class MockIntersectionObserver implements IntersectionObserver {
  public observedElements: HTMLElement[] = [];
  public unobservedElements: HTMLElement[] = [];
  public readonly callback: IntersectionObserverCallback;
  public readonly root: Element | Document | null = null;
  public readonly rootMargin: string = '0px';
  public readonly thresholds: ReadonlyArray<number> = [0.1];

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  public observe(target: HTMLElement): void {
    this.observedElements.push(target);
  }

  public unobserve(target: HTMLElement): void {
    this.unobservedElements.push(target);
  }

  public disconnect(): void {
    this.observedElements = [];
  }

  public takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  public triggerIntersection(target: HTMLElement, isIntersecting: boolean): void {
    const entry = {
      target,
      isIntersecting,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: isIntersecting ? 1 : 0,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: Date.now(),
    };
    this.callback([entry], this);
  }
}

test('WhatsAppMessageScanner deve registrar no IntersectionObserver e enfileirar somente ao entrar no viewport', async () => {
  const enqueuedTasks: string[] = [];

  const fakeQueue = {
    isAutoEnabled: () => true,
    enqueue: (task: { audioId: string }) => enqueuedTasks.push(task.audioId),
    setEnabled: () => {},
  } as unknown as AutoTranscribeQueue;

  let mockObserver: MockIntersectionObserver | null = null;
  const scanner = new WhatsAppMessageScanner(
    undefined,
    undefined,
    undefined,
    fakeQueue,
    new MessageAgeValidator(),
    null
  );

  // Set mock observer directly
  mockObserver = new MockIntersectionObserver((entries) => {
    (scanner as any).handleVisibilityEntries(entries);
  });
  (scanner as any).visibilityObserver = mockObserver;

  const button = {
    isConnected: true,
    textContent: '🎙 Transcrever',
    dataset: {},
  } as unknown as HTMLButtonElement;

  const messageElement = {
    isConnected: true,
    dataset: {},
    classList: {
      contains: () => false,
    },
    getAttribute(attr: string) {
      if (attr === 'data-id') return 'false_123456@c.us_3EB01234';
      return null;
    },
    hasAttribute() {
      return false;
    },
    querySelector() {
      return null;
    },
    appendChild() {},
  } as unknown as HTMLElement;

  const targetElement = {
    isConnected: true,
    closest: () => null,
  } as unknown as HTMLElement;

  const container = {
    isConnected: true,
    querySelector: () => null,
  } as unknown as HTMLElement;

  // Chamada de queueOrObserveMessage
  (scanner as any).queueOrObserveMessage(messageElement, targetElement, button, container);

  // Deve ter registrado no observer mas ainda NÃO deve estar na fila
  assert.equal(mockObserver.observedElements.length, 1);
  assert.equal(enqueuedTasks.length, 0);

  // Simula evento de scroll onde o elemento ainda NÃO está no viewport
  mockObserver.triggerIntersection(messageElement, false);
  assert.equal(enqueuedTasks.length, 0);

  // Simula elemento entrando no viewport
  mockObserver.triggerIntersection(messageElement, true);
  assert.equal(enqueuedTasks.length, 1);
  assert.equal(enqueuedTasks[0], 'false_123456@c.us_3EB01234');
  assert.equal(mockObserver.unobservedElements.length, 1);
});

test('WhatsAppMessageScanner deve descartar da transcrição automática mensagens com mais de 24h', () => {
  const enqueuedTasks: string[] = [];

  const fakeQueue = {
    isAutoEnabled: () => true,
    enqueue: (task: { audioId: string }) => enqueuedTasks.push(task.audioId),
    setEnabled: () => {},
  } as unknown as AutoTranscribeQueue;

  const mockObserver = new MockIntersectionObserver(() => {});
  const scanner = new WhatsAppMessageScanner(
    undefined,
    undefined,
    undefined,
    fakeQueue,
    new MessageAgeValidator(),
    mockObserver
  );

  const button = {
    isConnected: true,
    textContent: '🎙 Transcrever',
    dataset: {},
  } as unknown as HTMLButtonElement;

  const now = 1730640000000;
  const twoDaysAgoSeconds = String(Math.floor((now - 48 * 3600 * 1000) / 1000));

  const oldMessageElement = {
    isConnected: true,
    dataset: { timestamp: twoDaysAgoSeconds },
    getAttribute(attr: string) {
      if (attr === 'data-timestamp') return twoDaysAgoSeconds;
      return null;
    },
    hasAttribute(attr: string) {
      return attr === 'data-timestamp';
    },
    querySelector() {
      return null;
    },
  } as unknown as HTMLElement;

  (scanner as any).queueOrObserveMessage(oldMessageElement, {} as HTMLElement, button);

  // Mensagem antiga não deve ser observada nem enfileirada para auto-transcribe
  assert.equal(mockObserver.observedElements.length, 0);
  assert.equal(enqueuedTasks.length, 0);
});
