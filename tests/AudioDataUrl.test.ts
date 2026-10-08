import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioDataUrl } from '../src/domain/AudioDataUrl.js';

test('AudioDataUrl deve validar esquema data:', () => {
  assert.throws(() => new AudioDataUrl('https://example.com/audio.mp3'), /esquema data:/);
});

test('AudioDataUrl deve extrair mimeType e base64 payload', () => {
  const dataUrl = new AudioDataUrl('data:audio/ogg;codecs=opus;base64,T2dnUwACAAAAAAAAAAA=');
  assert.equal(dataUrl.extractMimeType(), 'audio/ogg');
  assert.equal(dataUrl.extractBase64Payload(), 'T2dnUwACAAAAAAAAAAA=');
});
