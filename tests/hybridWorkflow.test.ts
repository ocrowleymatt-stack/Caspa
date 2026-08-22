import assert from 'node:assert/strict';
import test from 'node:test';
import { canMoveBetweenStages, contextualTools, nextHybridStage } from '../src/services/hybridWorkflow';
import { manuscriptMetrics } from '../src/services/hybridCoreRepository';
import { STAGE_HELP, STAGE_NEXT } from '../src/services/workspaceCatalog';

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
  assert.ok(contextualTools('publish').includes('Imagine'));
  assert.ok(contextualTools('workshop').includes('Critic Swarm'));
});

test('desk copy stays human and every stage has a next hint', () => {
  for (const help of Object.values(STAGE_HELP)) {
    assert.doesNotMatch(help, /PostgreSQL|OCR|checksum|artefact|immutable|preflight/i);
    assert.ok(help.length > 20);
  }
  assert.equal(STAGE_NEXT.Draft.next, 'Workshop');
  assert.equal(STAGE_NEXT.Publish.next, undefined);
  assert.match(STAGE_NEXT.Idea.nextLabel || '', /Structure/);
  assert.match(STAGE_HELP.Workshop, /critics/i);
  assert.doesNotMatch(STAGE_HELP.Workshop, /Read the book/);
});

test('manuscript metrics count chapters rather than every subheading', () => {
  const content = '# Book title\n\n# CHAPTER 1: Arrival\n\n## Background\nWords here.\n\n# CHAPTER 2: Turn\n\n### Detail\nMore words.';
  assert.equal(manuscriptMetrics(content).chapterCount, 2);
});
