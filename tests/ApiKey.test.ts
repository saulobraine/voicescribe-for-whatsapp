import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiKey } from '../src/domain/ApiKey.js';

test('ApiKey deve rejeitar chave vazia', () => {
  assert.throws(() => new ApiKey('   '), /não pode estar vazia/);
});

test('ApiKey deve mascarar chave longa preservando início e fim', () => {
  const key = new ApiKey('AIzaSyAbcdef123456789XyZ');
  assert.equal(key.toMaskedString(), 'AIza...9XyZ');
});

test('ApiKey deve mascarar chave curta', () => {
  const key = new ApiKey('123456');
  assert.equal(key.toMaskedString(), '****');
});

test('ApiKey matches deve comparar corretamente', () => {
  const key = new ApiKey('AIzaTest123');
  assert.equal(key.matches('AIzaTest123'), true);
  assert.equal(key.matches('AIzaOutra'), false);
});
