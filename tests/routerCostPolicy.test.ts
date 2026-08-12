import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyTask, providerOrder } from '../src/services/cloudModelRouter';
import { providerSupportsWebSearch, WEB_SEARCH_CAPABLE_PROVIDERS } from '../src/services/routerFailover';

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
    ['venice', 'grok', 'gemini', 'openai', 'claude'],
  );
});

test('balanced heavy reasoning uses cheap heavyweight lane before premium providers', () => {
  assert.deepEqual(
    providerOrder('', 'balanced', 'reasoning'),
    ['venice', 'grok', 'gemini', 'openai', 'claude'],
  );
});

test('god mode keeps maximum-capability ordering for deep reasoning', () => {
  assert.deepEqual(
    providerOrder('', 'god', 'reasoning'),
    ['venice', 'grok', 'gemini', 'openai', 'claude'],
  );
});

test('explicit provider override remains first', () => {
  assert.equal(providerOrder('openai', 'balanced', 'fast')[0], 'openai');
});

test('web search capability is limited to providers with real tool bindings', () => {
  assert.deepEqual([...WEB_SEARCH_CAPABLE_PROVIDERS], ['venice', 'gemini', 'grok']);
  assert.equal(providerSupportsWebSearch('gemini'), true);
  assert.equal(providerSupportsWebSearch('grok'), true);
  assert.equal(providerSupportsWebSearch('venice'), true);
  assert.equal(providerSupportsWebSearch('openai'), false);
  assert.equal(providerSupportsWebSearch('claude'), false);
  assert.equal(providerSupportsWebSearch('ollama'), false);
});

test('web-required provider order cannot silently include a non-search lane', () => {
  const factual = providerOrder('', 'balanced', 'factual').filter(providerSupportsWebSearch);
  assert.deepEqual(factual, ['venice', 'grok', 'gemini']);

  const grokFirst = providerOrder('grok', 'balanced', 'factual').filter(providerSupportsWebSearch);
  assert.deepEqual(grokFirst, ['grok', 'venice', 'gemini']);
});
