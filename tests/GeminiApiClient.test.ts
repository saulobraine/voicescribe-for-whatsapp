import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GeminiApiClient } from '../src/infrastructure/GeminiApiClient.js';

test('GeminiApiClient deve extrair texto de payload com steps da Interactions API', () => {
  const client = new GeminiApiClient();
  const mockPayload = {
    steps: [
      {
        type: 'model',
        content: [
          { type: 'text', text: 'Transcrição extraída com sucesso de mensagem de áudio.' },
        ],
      },
    ],
  };

  const extracted = client.extractInteractionText(mockPayload);
  assert.equal(extracted, 'Transcrição extraída com sucesso de mensagem de áudio.');
});

test('GeminiApiClient deve extrair output_text direto quando presente', () => {
  const client = new GeminiApiClient();
  const mockPayload = {
    output_text: 'Áudio transcrito diretamente em output_text.',
  };

  const extracted = client.extractInteractionText(mockPayload);
  assert.equal(extracted, 'Áudio transcrito diretamente em output_text.');
});

test('GeminiApiClient deve retornar string vazia para payload inválido ou sem texto', () => {
  const client = new GeminiApiClient();
  assert.equal(client.extractInteractionText(null), '');
  assert.equal(client.extractInteractionText({}), '');
  assert.equal(client.extractInteractionText({ steps: [] }), '');
});

test('GeminiApiClient parseRetryDelay deve extrair segundos do header Retry-After', () => {
  const headers = new Headers({ 'retry-after': '35' });
  const delay = GeminiApiClient.parseRetryDelay(headers);
  assert.equal(delay, 35000);
});

test('GeminiApiClient parseRetryDelay deve extrair tempo de google.rpc.RetryInfo string', () => {
  const errorJson = {
    error: {
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.RetryInfo',
          retryDelay: '27.534s',
        },
      ],
    },
  };
  const delay = GeminiApiClient.parseRetryDelay(null, errorJson);
  assert.equal(delay, 27534);
});

test('GeminiApiClient parseRetryDelay deve extrair tempo de google.rpc.RetryInfo com seconds e nanos', () => {
  const errorJson = {
    error: {
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.RetryInfo',
          retryDelay: { seconds: 12, nanos: 400000000 },
        },
      ],
    },
  };
  const delay = GeminiApiClient.parseRetryDelay(null, errorJson);
  assert.equal(delay, 12400);
});

test('GeminiApiClient parseRetryDelay deve extrair tempo da mensagem de erro com segundos decimais', () => {
  const errorJson = {
    error: {
      message: 'Resource has been exhausted (e.g. check quota). Please retry after 28.5s.',
    },
  };
  const delay = GeminiApiClient.parseRetryDelay(null, errorJson);
  assert.equal(delay, 28500);
});

test('GeminiApiClient parseRetryDelay deve extrair tempo da mensagem de erro com minutos e segundos', () => {
  const rawText = 'Quota exceeded. Please retry in 1m 20s.';
  const delay = GeminiApiClient.parseRetryDelay(null, null, rawText);
  assert.equal(delay, 80000);
});

test('GeminiApiClient parseRetryDelay deve retornar fallback padrão de 60s quando não houver tempo', () => {
  const delay = GeminiApiClient.parseRetryDelay(null, { error: { message: 'Quota exceeded' } });
  assert.equal(delay, 60000);
});
