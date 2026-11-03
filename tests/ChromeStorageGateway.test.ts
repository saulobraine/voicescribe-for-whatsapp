import test from 'node:test';
import assert from 'node:assert/strict';
import { ChromeStorageGateway } from '../src/infrastructure/ChromeStorageGateway.js';

function setupMockChromeStorage(initialData: Record<string, unknown> = {}): void {
  const store: Record<string, unknown> = { ...initialData };
  (globalThis as any).chrome = {
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
