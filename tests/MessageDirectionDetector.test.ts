import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageDirectionDetector } from '../src/content/MessageDirectionDetector.js';

function createMockElement(options: {
  dataId?: string;
  hasTailOut?: boolean;
  hasTailIn?: boolean;
  hasYouLabel?: boolean;
  hasMetaStatus?: boolean;
  isRightSide?: boolean;
}): HTMLElement {
  return {
    getAttribute(attr: string) {
      if (attr === 'data-id') return options.dataId || null;
      return null;
    },
    dataset: {
      id: options.dataId,
    },
    classList: {
      contains() { return false; },
    },
    querySelector(selector: string) {
      if (options.hasTailOut && selector.includes('tail-out')) return {};
      if (options.hasTailIn && selector.includes('tail-in')) return {};
      if (options.hasYouLabel && selector.includes('Você')) return {};
      if (options.hasMetaStatus && selector.includes('msg-meta')) {
        return {
          querySelector() { return {}; },
          querySelectorAll() { return []; },
        };
      }
      return null;
    },
    querySelectorAll() {
      return [];
    },
    closest() {
      return null;
    },
    getBoundingClientRect() {
      return { left: 0, right: 0, width: 0, height: 0 };
    },
  } as unknown as HTMLElement;
}

test('MessageDirectionDetector deve identificar tail-out como outgoing', () => {
  const detector = new MessageDirectionDetector();
  const element = createMockElement({ hasTailOut: true });
  const direction = detector.detect(element);
  assert.equal(direction.isOutgoing(), true);
  assert.equal(direction.toCssClass(), 'wgt-out');
});

test('MessageDirectionDetector deve identificar tail-in como incoming', () => {
  const detector = new MessageDirectionDetector();
  const element = createMockElement({ hasTailIn: true });
  const direction = detector.detect(element);
  assert.equal(direction.isOutgoing(), false);
  assert.equal(direction.toCssClass(), 'wgt-in');
});

test('MessageDirectionDetector deve identificar Você: como outgoing', () => {
  const detector = new MessageDirectionDetector();
  const element = createMockElement({ hasYouLabel: true });
  const direction = detector.detect(element);
  assert.equal(direction.isOutgoing(), true);
});

test('MessageDirectionDetector deve identificar status de entrega em msg-meta como outgoing', () => {
  const detector = new MessageDirectionDetector();
  const element = createMockElement({ hasMetaStatus: true });
  const direction = detector.detect(element);
  assert.equal(direction.isOutgoing(), true);
});

test('MessageDirectionDetector deve retornar incoming por padrão em mensagens consecutivas sem marcadores', () => {
  const detector = new MessageDirectionDetector();
  const element = createMockElement({});
  const direction = detector.detect(element);
  assert.equal(direction.isOutgoing(), false);
  assert.equal(direction.toCssClass(), 'wgt-in');
});
