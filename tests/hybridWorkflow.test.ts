import assert from 'node:assert/strict';
import test from 'node:test';
import { canMoveBetweenStages, contextualTools, nextHybridStage } from '../src/services/hybridWorkflow';

test('hybrid workflow guides forward without trapping the author', () => {
  assert.equal(nextHybridStage('draft'), 'workshop');
  assert.equal(nextHybridStage('publish'), 'publish');
  assert.equal(canMoveBetweenStages('workshop', 'draft'), true);
  assert.equal(canMoveBetweenStages('publish', 'revise'), true);
  assert.equal(canMoveBetweenStages('draft', 'publish'), false);
});

test('specialist capabilities appear contextually', () => {
  assert.ok(contextualTools('draft').includes('Story bible'));
  assert.ok(contextualTools('revise').includes('Gold Refinery'));
  assert.ok(contextualTools('publish').includes('Proof'));
});
