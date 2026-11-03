import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageAgeValidator } from '../src/content/MessageAgeValidator.js';

function createMockElement(attributes: Record<string, string>): HTMLElement {
  return {
    getAttribute(attr: string) {
      return attributes[attr] || null;
    },
    hasAttribute(attr: string) {
      return Boolean(attributes[attr]);
    },
    dataset: attributes,
    querySelector(selector: string) {
      if (selector.includes('[data-pre-plain-text]') && attributes['data-pre-plain-text']) {
        return createMockElement({ 'data-pre-plain-text': attributes['data-pre-plain-text'] });
      }
      return null;
    },
  } as unknown as HTMLElement;
}

test('MessageAgeValidator deve considerar recente mensagem sem timestamp explícito', () => {
  const validator = new MessageAgeValidator();
  const element = createMockElement({});
  const isRecent = validator.isWithinLast24Hours(element);
  assert.equal(isRecent, true);
});

test('MessageAgeValidator deve validar data-timestamp numérico recente (segundos)', () => {
  const validator = new MessageAgeValidator();
  const now = 1730640000000;
  const twoHoursAgoSeconds = String(Math.floor((now - 2 * 3600 * 1000) / 1000));
  const element = createMockElement({ 'data-timestamp': twoHoursAgoSeconds });

  const isRecent = validator.isWithinLast24Hours(element, now);
  assert.equal(isRecent, true);
});

test('MessageAgeValidator deve rejeitar data-timestamp com mais de 24 horas', () => {
  const validator = new MessageAgeValidator();
  const now = 1730640000000;
  const thirtyHoursAgoSeconds = String(Math.floor((now - 30 * 3600 * 1000) / 1000));
  const element = createMockElement({ 'data-timestamp': thirtyHoursAgoSeconds });

  const isRecent = validator.isWithinLast24Hours(element, now);
  assert.equal(isRecent, false);
});

test('MessageAgeValidator deve extrair data de data-pre-plain-text recente', () => {
  const validator = new MessageAgeValidator();
  const fixedNow = new Date(2026, 10, 3, 15, 0, 0).getTime(); // 03/11/2026 às 15:00
  const element = createMockElement({
    'data-pre-plain-text': '[14:30, 03/11/2026] Contato: ',
  });

  const isRecent = validator.isWithinLast24Hours(element, fixedNow);
  assert.equal(isRecent, true);
});

test('MessageAgeValidator deve rejeitar data-pre-plain-text com mais de 24 horas', () => {
  const validator = new MessageAgeValidator();
  const fixedNow = new Date(2026, 10, 3, 15, 0, 0).getTime(); // 03/11/2026 às 15:00
  const element = createMockElement({
    'data-pre-plain-text': '[10:00, 01/11/2026] Contato: ', // 2 dias atrás
  });

  const isRecent = validator.isWithinLast24Hours(element, fixedNow);
  assert.equal(isRecent, false);
});
