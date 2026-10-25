import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiKeyPool } from '../src/domain/ApiKeyPool.js';

test('ApiKeyPool deve gerenciar chaves e selecionar a chave com menor uso', () => {
  let pool = new ApiKeyPool();
  pool = pool.addKey('AIzaKeyOne');
  pool = pool.addKey('AIzaKeyTwo');

  assert.equal(pool.count(), 2);

  const active = pool.getAvailableKey();
  assert.ok(active);
  if (!active) {
    return;
  }
  assert.equal(active.key, 'AIzaKeyOne');

  pool = pool.incrementUsage(active.id);

  const nextActive = pool.getAvailableKey();
  assert.ok(nextActive);
  if (!nextActive) {
    return;
  }
  assert.equal(nextActive.key, 'AIzaKeyTwo');
});

test('ApiKeyPool deve ignorar chaves em cooldown', () => {
  let pool = new ApiKeyPool();
  pool = pool.addKey('AIzaKeyOne');
  pool = pool.addKey('AIzaKeyTwo');

  const first = pool.getAvailableKey();
  assert.ok(first);
  if (!first) {
    return;
  }

  pool = pool.markRateLimited(first.id, Date.now() + 60000);

  const second = pool.getAvailableKey();
  assert.ok(second);
  if (!second) {
    return;
  }
  assert.equal(second.key, 'AIzaKeyTwo');
});

test('ApiKeyPool deve alternar status ativo/inativo', () => {
  let pool = new ApiKeyPool();
  pool = pool.addKey('AIzaKeyOne');
  const record = pool.getAvailableKey();
  assert.ok(record);
  if (!record) {
    return;
  }

  pool = pool.toggleKey(record.id);
  assert.equal(pool.getAvailableKey(), null);

  pool = pool.toggleKey(record.id);
  assert.ok(pool.getAvailableKey());
});
