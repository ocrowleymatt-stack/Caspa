import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyTask, providerOrder } from '../src/services/cloudModelRouter';

test('speed mode starts on economical high-throughput providers', () => {
  assert.deepEqual(
    providerOrder('', 'speed', 'fast'),
    ['gemini', 'venice', 'grok', 'openai', 'claude'],
  );
});

test('balanced factual and OSINT work prefers economical analysis lanes', () => {
  assert.equal(classifyTask('Expand this OSINT evidence bundle and identify new pivots'), 'factual');
  assert.deepEqual(
    providerOrder('', 'balanced', 'factual'),
    ['gemini', 'venice', 'grok', 'openai', 'claude'],
  );
});

test('balanced heavy reasoning uses cheap heavyweight lane before premium providers', () => {
  assert.deepEqual(
    providerOrder('', 'balanced', 'reasoning'),
    ['venice', 'gemini', 'grok', 'openai', 'claude'],
  );
});

test('god mode keeps maximum-capability ordering for deep reasoning', () => {
  assert.deepEqual(
    providerOrder('', 'god', 'reasoning'),
    ['grok', 'gemini', 'venice', 'openai', 'claude'],
  );
});

test('explicit provider override remains first', () => {
  assert.equal(providerOrder('openai', 'balanced', 'fast')[0], 'openai');
});
