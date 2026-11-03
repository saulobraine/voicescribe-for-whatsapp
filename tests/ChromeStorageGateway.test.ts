import test from 'node:test';
import assert from 'node:assert/strict';
import { ChromeStorageGateway } from '../src/infrastructure/ChromeStorageGateway.js';

function setupMockChromeStorage(initialData: Record<string, unknown> = {}): void {
  const store: Record<string, unknown> = { ...initialData };
  (globalThis as any).chrome = {
    runtime: {
      id: 'test_extension_id',
    },
    storage: {
      local: {
        get: async (keys: string[] | null) => {
          if (!keys) {
            return { ...store };
          }
          const result: Record<string, unknown> = {};
          keys.forEach((key) => {
            if (key in store) {
              result[key] = store[key];
            }
          });
          return result;
        },
        set: async (items: Record<string, unknown>) => {
          Object.assign(store, items);
        },
        remove: async (keys: string[]) => {
          keys.forEach((key) => {
            delete store[key];
          });
        },
      },
    },
  };
}

test('ChromeStorageGateway deve retornar false por padrão para auto_transcribe_enabled', async () => {
  setupMockChromeStorage();
  const gateway = new ChromeStorageGateway();
  const enabled = await gateway.isAutoTranscribeEnabled();
  assert.equal(enabled, false);
});

test('ChromeStorageGateway deve salvar e recuperar auto_transcribe_enabled com sucesso', async () => {
  setupMockChromeStorage();
  const gateway = new ChromeStorageGateway();

  await gateway.setAutoTranscribeEnabled(true);
  const enabled = await gateway.isAutoTranscribeEnabled();
  assert.equal(enabled, true);

  await gateway.setAutoTranscribeEnabled(false);
  const disabled = await gateway.isAutoTranscribeEnabled();
  assert.equal(disabled, false);
});

test('ChromeStorageGateway deve retornar fallbacks seguros quando runtime.id não existir (contexto invalidado)', async () => {
  (globalThis as any).chrome = {
    runtime: {},
    storage: {
      local: {
        get: async () => ({}),
        set: async () => {},
      },
    },
  };
  const gateway = new ChromeStorageGateway();

  assert.equal(gateway.isStorageAvailable(), false);
  assert.deepEqual(await gateway.getStoredKeys(), []);
  assert.equal(await gateway.getSelectedModel(), 'gemini-3.8-flash');
  assert.equal(await gateway.isAutoTranscribeEnabled(), false);
  assert.equal(await gateway.getCachedTranscription('msg_123'), null);
  assert.equal(await gateway.clearAllCache(), 0);

  await assert.doesNotReject(async () => {
    await gateway.saveStoredKeys([]);
    await gateway.setSelectedModel('gemini-1.5-flash');
    await gateway.setAutoTranscribeEnabled(true);
    await gateway.saveCachedTranscription('msg_123', 'texto');
  });
});

test('ChromeStorageGateway deve capturar exceção de Extension context invalidated sem quebrar', async () => {
  (globalThis as any).chrome = {
    runtime: { id: 'test_extension_id' },
    storage: {
      local: {
        get: async () => {
          throw new Error('Extension context invalidated.');
        },
        set: async () => {
          throw new Error('Extension context invalidated.');
        },
        remove: async () => {
          throw new Error('Extension context invalidated.');
        },
      },
    },
  };
  const gateway = new ChromeStorageGateway();

  assert.deepEqual(await gateway.getStoredKeys(), []);
  assert.equal(await gateway.getSelectedModel(), 'gemini-3.8-flash');
  assert.equal(await gateway.isAutoTranscribeEnabled(), false);
  assert.equal(await gateway.getCachedTranscription('msg_123'), null);
  assert.equal(await gateway.clearAllCache(), 0);

  await assert.doesNotReject(async () => {
    await gateway.saveStoredKeys([]);
    await gateway.setSelectedModel('gemini-1.5-flash');
    await gateway.setAutoTranscribeEnabled(true);
    await gateway.saveCachedTranscription('msg_123', 'texto');
  });
});
