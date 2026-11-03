import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoTranscribeQueue, AutoTranscribeTask } from '../src/content/AutoTranscribeQueue.js';
import { ChromeStorageGateway } from '../src/infrastructure/ChromeStorageGateway.js';

function createMockTask(options: {
  audioId?: string;
  isConnected?: boolean;
  buttonText?: string;
  isTerminalError?: boolean;
  hasBubble?: boolean;
}): AutoTranscribeTask {
  const isConnected = options.isConnected ?? true;
  const messageElement = {
    isConnected,
    dataset: options.isTerminalError ? { wgtTerminalError: 'true' } : {},
  } as unknown as HTMLElement;

  const targetElement = {
    isConnected,
  } as unknown as HTMLElement;

  const button = {
    isConnected,
    textContent: options.buttonText || '🎙 Transcrever',
    dataset: options.isTerminalError ? { wgtTerminalError: 'true' } : {},
  } as unknown as HTMLButtonElement;

  const container = {
    isConnected,
    querySelector(selector: string) {
      if (options.hasBubble && selector.includes('.wgt-bubble')) {
        return {};
      }
      return null;
    },
  } as unknown as HTMLElement;

  return {
    messageElement,
    targetElement,
    button,
    container,
    audioId: options.audioId || `audio_${Math.random().toString(36).substring(2)}`,
  };
}

function createMockStorage(cachedIds: string[] = []): ChromeStorageGateway {
  const cacheSet = new Set(cachedIds);
  return {
    async getCachedTranscription(id: string) {
      return cacheSet.has(id) ? 'transcricao em cache' : null;
    },
  } as unknown as ChromeStorageGateway;
}

test('AutoTranscribeQueue deve processar tarefas sequencialmente em ordem FIFO', async () => {
  const executionOrder: string[] = [];
  const storage = createMockStorage();

  const queue = new AutoTranscribeQueue(
    storage,
    async (task) => {
      executionOrder.push(task.audioId);
    },
    0
  );

  queue.setEnabled(true);

  const task1 = createMockTask({ audioId: 'msg_1' });
  const task2 = createMockTask({ audioId: 'msg_2' });
  const task3 = createMockTask({ audioId: 'msg_3' });

  queue.enqueue(task1);
  queue.enqueue(task2);
  queue.enqueue(task3);

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.deepEqual(executionOrder, ['msg_1', 'msg_2', 'msg_3']);
  assert.equal(queue.size(), 0);
});

test('AutoTranscribeQueue deve ignorar nós desconectados do DOM', async () => {
  const executed: string[] = [];
  const storage = createMockStorage();

  const queue = new AutoTranscribeQueue(
    storage,
    async (task) => {
      executed.push(task.audioId);
    },
    0
  );

  queue.setEnabled(true);

  const disconnectedTask = createMockTask({ audioId: 'disconnected', isConnected: false });
  const connectedTask = createMockTask({ audioId: 'connected', isConnected: true });

  queue.enqueue(disconnectedTask);
  queue.enqueue(connectedTask);

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.deepEqual(executed, ['connected']);
});

test('AutoTranscribeQueue deve pular áudios já transcritos', async () => {
  const executed: string[] = [];
  const storage = createMockStorage();

  const queue = new AutoTranscribeQueue(
    storage,
    async (task) => {
      executed.push(task.audioId);
    },
    0
  );

  queue.setEnabled(true);

  const transcribedTask = createMockTask({ audioId: 'transcribed_1', buttonText: '✓ Transcrito' });
  const bubbleTask = createMockTask({ audioId: 'transcribed_2', hasBubble: true });
  const pendingTask = createMockTask({ audioId: 'pending_1', buttonText: '🎙 Transcrever' });

  queue.enqueue(transcribedTask);
  queue.enqueue(bubbleTask);
  queue.enqueue(pendingTask);

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.deepEqual(executed, ['pending_1']);
});

test('AutoTranscribeQueue deve pular áudios com cache', async () => {
  const executed: string[] = [];
  const storage = createMockStorage(['cached_audio_id']);

  const queue = new AutoTranscribeQueue(
    storage,
    async (task) => {
      executed.push(task.audioId);
    },
    0
  );

  queue.setEnabled(true);

  const cachedTask = createMockTask({ audioId: 'cached_audio_id' });
  const freshTask = createMockTask({ audioId: 'fresh_audio_id' });

  queue.enqueue(cachedTask);
  queue.enqueue(freshTask);

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.deepEqual(executed, ['fresh_audio_id']);
});

test('AutoTranscribeQueue deve pular áudios com erro terminal', async () => {
  const executed: string[] = [];
  const storage = createMockStorage();

  const queue = new AutoTranscribeQueue(
    storage,
    async (task) => {
      executed.push(task.audioId);
    },
    0
  );

  queue.setEnabled(true);

  const terminalTask1 = createMockTask({ audioId: 'terminal_1', isTerminalError: true });
  const terminalTask2 = createMockTask({ audioId: 'terminal_2', buttonText: '✕ Erro' });
  const normalTask = createMockTask({ audioId: 'normal_1' });

  queue.enqueue(terminalTask1);
  queue.enqueue(terminalTask2);
  queue.enqueue(normalTask);

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.deepEqual(executed, ['normal_1']);
});

test('AutoTranscribeQueue deve respeitar throttle entre execuções', async () => {
  const executionTimes: number[] = [];
  const storage = createMockStorage();

  const queue = new AutoTranscribeQueue(
    storage,
    async () => {
      executionTimes.push(Date.now());
    },
    40
  );

  queue.setEnabled(true);

  queue.enqueue(createMockTask({ audioId: 'throttled_1' }));
  queue.enqueue(createMockTask({ audioId: 'throttled_2' }));

  await new Promise((resolve) => setTimeout(resolve, 150));

  assert.equal(executionTimes.length, 2);
  const diff = executionTimes[1] - executionTimes[0];
  assert.ok(diff >= 35, `Throttle esperado >= 35ms, obtido: ${diff}ms`);
});

test('AutoTranscribeQueue deve pausar em rate limit e retomar na chamada resume()', async () => {
  const executionLog: string[] = [];
  const storage = createMockStorage();

  let shouldFailWithRateLimit = true;
  const queue = new AutoTranscribeQueue(
    storage,
    async (task) => {
      if (shouldFailWithRateLimit && task.audioId === 'rate_limited') {
        shouldFailWithRateLimit = false;
        throw new Error('Limite da API atingido em todas as chaves do pool. Tente novamente após 23:59:59.');
      }
      executionLog.push(task.audioId);
    },
    0
  );

  queue.setEnabled(true);

  const task = createMockTask({ audioId: 'rate_limited' });
  queue.enqueue(task);

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(queue.isPaused(), true);
  assert.equal(executionLog.length, 0);

  queue.resume();

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(queue.isPaused(), false);
  assert.deepEqual(executionLog, ['rate_limited']);
});

test('AutoTranscribeQueue deve pular throttle quando a tarefa for descartada', async () => {
  const executionTimes: number[] = [];
  const storage = createMockStorage(['cached_skip']);

  const queue = new AutoTranscribeQueue(
    storage,
    async () => {
      executionTimes.push(Date.now());
    },
    200
  );

  queue.setEnabled(true);

  const start = Date.now();
  queue.enqueue(createMockTask({ audioId: 'cached_skip' }));
  queue.enqueue(createMockTask({ audioId: 'transcribed_skip', buttonText: '✓ Transcrito' }));

  await new Promise((resolve) => setTimeout(resolve, 60));

  const elapsed = Date.now() - start;
  assert.equal(executionTimes.length, 0);
  assert.ok(elapsed < 150, `Tempo decorrido (${elapsed}ms) deveria ser menor que o throttle (200ms)`);
});

test('AutoTranscribeQueue clear deve esvaziar a fila e cancelar timers', () => {
  const storage = createMockStorage();
  const queue = new AutoTranscribeQueue(storage, async () => {}, 1000);

  queue.pause(60000);
  assert.equal(queue.isPaused(), true);

  queue.clear();
  assert.equal(queue.isPaused(), false);
  assert.equal(queue.size(), 0);
});
