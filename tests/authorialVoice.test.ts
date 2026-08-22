import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyAuthorialVoice,
  authorialVoiceForMode,
  OCROWLEY_VOICE_MARKERS,
} from '../src/services/serverAiHelper';

test('fiction master control is a stable prefix and contains its non-negotiable rules', () => {
  const task = 'Caspa: rewrite this novel chapter without changing the plot.';
  const controlled = applyAuthorialVoice(task, 'fiction');

  assert.ok(controlled.startsWith(OCROWLEY_VOICE_MARKERS.fiction));
  assert.match(controlled, /O.CROWLEY LITERARY VOICE — MASTER CONTROL PROMPT/);
  assert.match(controlled, /Never replace them with generic literary imagery/);
  assert.ok(controlled.endsWith(task));
  assert.equal(applyAuthorialVoice(controlled, 'fiction'), controlled);
});

test('non-fiction master control is selected for nonfiction and essay modes', () => {
  for (const mode of ['nonfiction', 'non-fiction', 'essay']) {
    assert.equal(authorialVoiceForMode(mode), 'nonfiction');
  }
  assert.equal(authorialVoiceForMode('novel'), 'fiction');

  const task = 'Caspa: write a nonfiction section from verified evidence.';
  const controlled = applyAuthorialVoice(task, 'auto');
  assert.ok(controlled.startsWith(OCROWLEY_VOICE_MARKERS.nonfiction));
  assert.match(controlled, /O.CROWLEY NON-FICTION VOICE — MASTER CONTROL PROMPT/);
  assert.match(controlled, /Precision is more damaging to a bad argument than outrage/);
  assert.doesNotMatch(controlled, /O.CROWLEY LITERARY VOICE — MASTER CONTROL PROMPT/);
});

test('non-writing inference calls remain unstyled', () => {
  const task = 'Extract dimensions from this image header and return JSON.';
  assert.equal(applyAuthorialVoice(task, 'auto'), task);
  assert.equal(applyAuthorialVoice(task, 'none'), task);
});
