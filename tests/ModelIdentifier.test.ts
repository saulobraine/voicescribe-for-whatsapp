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
  const textOnly = new ModelIdentifier('gemini-1.0-text-only');
  const dedicated = new ModelIdentifier('gemini-3.5-transcribe');

  assert.equal(flash.isAudioInputCompatible(), true);
  assert.equal(pro.isAudioInputCompatible(), true);
  assert.equal(textOnly.isAudioInputCompatible(), false);
  assert.equal(dedicated.isAudioInputCompatible(), true);
  assert.equal(dedicated.isDedicatedTranscriber(), true);
});
