import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelIdentifier } from '../src/domain/ModelIdentifier.js';

test('ModelIdentifier deve sanitizar caracteres inválidos', () => {
  const model = new ModelIdentifier(' models/gemini-2.5-flash!@# ');
  assert.equal(model.toEndpointString(), 'modelsgemini-2.5-flash');
});

test('ModelIdentifier deve identificar compatibilidade com áudio', () => {
  const flash = new ModelIdentifier('gemini-2.5-flash');
  const pro = new ModelIdentifier('gemini-3-pro');
  const gemini15 = new ModelIdentifier('gemini-1.5-flash');
  const gemini20 = new ModelIdentifier('gemini-2.0-flash');
  const textOnly = new ModelIdentifier('gemini-1.0-text-only');
  const dedicated = new ModelIdentifier('gemini-3.5-transcribe');
  const embedding = new ModelIdentifier('text-embedding-004');
  const imagen = new ModelIdentifier('imagen-3.0');

  assert.equal(flash.isAudioInputCompatible(), true);
  assert.equal(pro.isAudioInputCompatible(), true);
  assert.equal(gemini15.isAudioInputCompatible(), true);
  assert.equal(gemini20.isAudioInputCompatible(), true);
  assert.equal(textOnly.isAudioInputCompatible(), false);
  assert.equal(embedding.isAudioInputCompatible(), false);
  assert.equal(imagen.isAudioInputCompatible(), false);
  assert.equal(dedicated.isAudioInputCompatible(), true);
  assert.equal(dedicated.isDedicatedTranscriber(), true);
});
