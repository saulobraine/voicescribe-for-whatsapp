import test from 'node:test';
import assert from 'node:assert/strict';
import { TranscriptionText } from '../src/domain/TranscriptionText.js';

test('TranscriptionText deve rejeitar texto vazio', () => {
  assert.throws(() => new TranscriptionText('   '), /não pode ser vazio/);
});

test('TranscriptionText deve limpar markdown e contar palavras', () => {
  const text = new TranscriptionText('```json\nOlá, este é um teste de áudio.\n```');
  assert.equal(text.toDisplayText(), 'Olá, este é um teste de áudio.');
  assert.equal(text.wordCount(), 7);
});
