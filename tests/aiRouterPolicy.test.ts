import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isProviderConfigured,
  selectAttemptOrder,
  createCircuitBreaker,
  AI_PROVIDERS,
} from '../src/services/aiRouterPolicy';

test('isProviderConfigured respects presence and blank values', () => {
  const env = { GROK_API_KEY: 'x', OPENAI_API_KEY: '   ' } as NodeJS.ProcessEnv;
  assert.equal(isProviderConfigured('grok', env), true);
  assert.equal(isProviderConfigured('openai', env), false, 'blank key is not configured');
  assert.equal(isProviderConfigured('gemini', env), false, 'absent key is not configured');
});

test('unified router is configured by UNIFIED_ROUTER_URL and is preferred first', () => {
  assert.equal(isProviderConfigured('unified', { UNIFIED_ROUTER_URL: 'http://127.0.0.1:9999' } as NodeJS.ProcessEnv), true);
  assert.equal(isProviderConfigured('unified', { UNIFIED_ROUTER_URL: '  ' } as NodeJS.ProcessEnv), false);
  assert.equal(AI_PROVIDERS[0], 'unified');
});

test('selectAttemptOrder drops unconfigured providers', () => {
  const cfg = (p: string) => p === 'grok' || p === 'openai';
  const { attempt, anyConfigured } = selectAttemptOrder([...AI_PROVIDERS], cfg, () => false);
  assert.deepEqual(attempt, ['grok', 'openai']);
  assert.equal(anyConfigured, true);
});

test('selectAttemptOrder reports nothing configured', () => {
  const { attempt, anyConfigured } = selectAttemptOrder([...AI_PROVIDERS], () => false, () => false);
  assert.deepEqual(attempt, []);
  assert.equal(anyConfigured, false);
});

test('selectAttemptOrder skips a cooling provider when a healthy one exists', () => {
  const cfg = (p: string) => p === 'grok' || p === 'openai';
  const cooling = (p: string) => p === 'grok';
  const { attempt } = selectAttemptOrder([...AI_PROVIDERS], cfg, cooling);
  assert.deepEqual(attempt, ['openai']);
});

test('selectAttemptOrder falls back to all configured when every one is cooling', () => {
  const cfg = (p: string) => p === 'grok' || p === 'openai';
  const { attempt } = selectAttemptOrder([...AI_PROVIDERS], cfg, () => true);
  assert.deepEqual(attempt, ['grok', 'openai'], 'a blip must not lock the router out');
});

test('circuit breaker opens on failure and closes after cooldown', () => {
  let now = 1000;
  const cb = createCircuitBreaker(30_000, () => now);
  assert.equal(cb.isOpen('grok'), false);
  cb.recordFailure('grok');
  assert.equal(cb.isOpen('grok'), true);
  now += 29_000;
  assert.equal(cb.isOpen('grok'), true, 'still cooling before the window ends');
  now += 2_000;
  assert.equal(cb.isOpen('grok'), false, 'closed after the window');
});

test('circuit breaker success clears cooldown immediately', () => {
  let now = 1000;
  const cb = createCircuitBreaker(30_000, () => now);
  cb.recordFailure('gemini');
  assert.equal(cb.isOpen('gemini'), true);
  cb.recordSuccess('gemini');
  assert.equal(cb.isOpen('gemini'), false);
});
