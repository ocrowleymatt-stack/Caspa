import assert from 'node:assert/strict';
import test from 'node:test';
import { canMoveBetweenStages, contextualTools, nextHybridStage } from '../src/services/hybridWorkflow';
import { manuscriptMetrics } from '../src/services/hybridCoreRepository';

test('hybrid workflow guides forward without trapping the author', () => {
  assert.equal(nextHybridStage('idea'), 'structure');
  assert.equal(nextHybridStage('draft'), 'workshop');
  assert.equal(nextHybridStage('publish'), 'publish');
  assert.equal(canMoveBetweenStages('workshop', 'draft'), true);
  assert.equal(canMoveBetweenStages('publish', 'revise'), true);
  assert.equal(canMoveBetweenStages('draft', 'publish'), true);
});

test('specialist capabilities appear contextually', () => {
  assert.ok(contextualTools('draft').includes('Story Bible'));
  assert.ok(contextualTools('revise').includes('Gold Refinery'));
  assert.ok(contextualTools('publish').includes('Export and publishing'));
});

test('manuscript metrics count chapters rather than every subheading', () => {
  const content = '# Book title\n\n# CHAPTER 1: Arrival\n\n## Background\nWords here.\n\n# CHAPTER 2: Turn\n\n### Detail\nMore words.';
  assert.equal(manuscriptMetrics(content).chapterCount, 2);
});
