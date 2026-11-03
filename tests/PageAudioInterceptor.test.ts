import test from 'node:test';
import assert from 'node:assert/strict';
import { PageAudioInterceptor } from '../src/interceptor/PageAudioInterceptor.js';

test('PageAudioInterceptor deve resolver blob diretamente de WAWebMediaInMemoryBlobCache', async () => {
  const fakeBlob = new Blob(['fake audio content'], { type: 'audio/ogg' });

  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    require: (moduleName: string) => {
      if (moduleName === 'WAWebMediaInMemoryBlobCache') {
        return {
          get: (filehash: string) => {
            if (filehash === 'hash_test_123') {
              return fakeBlob;
            }
            return null;
          },
          getOrCreateURL: () => null,
        };
      }
      return null;
    },
  };

  const interceptor = new PageAudioInterceptor();
  const resolved = await (interceptor as any).tryResolveFromWhatsAppMediaCache('hash_test_123');

  assert.ok(resolved);
  assert.equal(resolved, fakeBlob);
});

test('PageAudioInterceptor deve buscar filehash em WAWebCollections quando fornecido apenas messageId', async () => {
  const fakeBlob = new Blob(['fake audio content 2'], { type: 'audio/ogg' });

  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    require: (moduleName: string) => {
      if (moduleName === 'WAWebCollections') {
        return {
          Msg: {
            get: (id: string) => {
              if (id === 'msg_with_hash') {
                return { filehash: 'discovered_hash_999' };
              }
              return null;
            },
          },
        };
      }
      if (moduleName === 'WAWebMediaInMemoryBlobCache') {
        return {
          get: (hash: string) => {
            if (hash === 'discovered_hash_999') {
              return fakeBlob;
            }
            return null;
          },
        };
      }
      return null;
    },
  };

  const interceptor = new PageAudioInterceptor();
  const resolved = await (interceptor as any).tryResolveFromWhatsAppMediaCache(undefined, 'msg_with_hash');

  assert.ok(resolved);
  assert.equal(resolved, fakeBlob);
});

test('PageAudioInterceptor deve disparar downloadMedia e obter blob descriptografado após polling', async () => {
  const fakeBlob = new Blob(['decrypted audio content'], { type: 'audio/ogg' });
  let downloadTriggered = false;
  let pollCounter = 0;

  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    require: (moduleName: string) => {
      if (moduleName === 'WAWebCollections') {
        return {
          Msg: {
            _models: [
              {
                id: { id: 'msg_download_test' },
                filehash: 'hash_download_123',
                downloadMedia: () => {
                  downloadTriggered = true;
                },
                mediaData: {},
              },
            ],
          },
        };
      }
      if (moduleName === 'WAWebMediaInMemoryBlobCache') {
        return {
          getOrCreateURL: (hash: string) => {
            pollCounter++;
            if (pollCounter >= 2 && hash === 'hash_download_123') {
              return 'blob:https://web.whatsapp.com/decrypted-uuid';
            }
            return null;
          },
        };
      }
      return null;
    },
  };

  const interceptor = new PageAudioInterceptor();
  (interceptor as any).tryFetchBlob = async (url: string) => {
    if (url === 'blob:https://web.whatsapp.com/decrypted-uuid') {
      return fakeBlob;
    }
    return null;
  };

  const resolved = await (interceptor as any).tryResolveFromWhatsAppMediaCache(undefined, 'msg_download_test');
  assert.ok(downloadTriggered, 'downloadMedia deve ter sido chamado');
  assert.equal(resolved, fakeBlob);
});
