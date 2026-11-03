import test from 'node:test';
import assert from 'node:assert/strict';
import { WhatsAppAudioCapturer } from '../src/content/WhatsAppAudioCapturer.js';

test('WhatsAppAudioCapturer deve rejeitar URLs .enc ou links externos de CDN', () => {
  const capturer = new WhatsAppAudioCapturer();

  assert.equal((capturer as any).isSafeLocalBlobUrl('https://mmg.whatsapp.net/m1/v/t24/audio.enc'), false);
  assert.equal((capturer as any).isSafeLocalBlobUrl('https://pps.whatsapp.net/v/t61/audio.ogg'), false);
  assert.equal((capturer as any).isSafeLocalBlobUrl('blob:https://web.whatsapp.com/test.enc'), false);
  assert.equal((capturer as any).isSafeLocalBlobUrl('blob:https://web.whatsapp.com/1234-5678-uuid'), true);
});

test('WhatsAppAudioCapturer deve priorizar cache de memória antes de playback silencioso', async () => {
  const capturer = new WhatsAppAudioCapturer();

  const messageElement = {
    getAttribute(attr: string) {
      if (attr === 'data-id') return 'msg_in_memory_1';
      return null;
    },
    dataset: {},
    querySelectorAll() {
      return [];
    },
  } as unknown as HTMLElement;

  (capturer as any).tryRequestFromPageCache = async () => 'data:audio/ogg;base64,AAAA';
  (capturer as any).captureViaSilentPlayback = async () => {
    throw new Error('Playback silencioso não deveria ser chamado!');
  };

  const dataUrl = await capturer.captureAudioDataUrl(messageElement);
  assert.equal(dataUrl, 'data:audio/ogg;base64,AAAA');
});
