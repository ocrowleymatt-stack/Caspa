import test from 'node:test';
import assert from 'node:assert/strict';

import { callWithProviderFailover } from '../src/services/routerFailover';

const CLOUD_KEYS = [
  'GROK_API_KEY', 'XAI_API_KEY', 'VITE_GROK_API_KEY',
  'GEMINI_API_KEY', 'VITE_GEMINI_API_KEY',
  'OPENAI_API_KEY', 'VITE_OPENAI_API_KEY',
  'ANTHROPIC_API_KEY', 'VITE_ANTHROPIC_API_KEY',
  'VENICE_API_KEY', 'VITE_VENICE_API_KEY',
  'UNIFIED_ROUTER_URL', 'UNIFIED_ROUTER_API_KEY', 'UNIFIED_ROUTER_MODEL',
];

test('falls through exhausted/unconfigured cloud providers to the local Ollama pool', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = new Map<string, string | undefined>();
  for (const key of CLOUD_KEYS) {
    originalEnv.set(key, process.env[key]);
    delete process.env[key];
  }
  originalEnv.set('OLLAMA_URL', process.env.OLLAMA_URL);
  process.env.OLLAMA_URL = 'http://127.0.0.1:11434/api';

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/tags')) {
      return new Response(JSON.stringify({
        models: [
          {
            name: 'qwen3.5:9b',
            details: { family: 'qwen3', parameter_size: '9B', quantization_level: 'Q4_K_M' },
          },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.endsWith('/api/generate')) {
      const body = JSON.parse(String(init?.body || '{}'));
      assert.equal(body.model, 'qwen3.5:9b');
      return new Response(JSON.stringify({ response: 'local survival response', model: 'qwen3.5:9b' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`Unexpected network call in test: ${url}`);
  }) as typeof fetch;

  try {
    const result = await callWithProviderFailover('Analyse this architecture.', { mode: 'balanced' });
    assert.equal(result.text, 'local survival response');
    assert.equal(result.provider, 'ollama');
    assert.equal(result.model, 'qwen3.5:9b');
    assert.ok(result.attempts.some((attempt) => attempt.provider === 'openai'));
    assert.ok(result.attempts.some((attempt) => attempt.provider === 'gemini'));
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('can explicitly disable the local survival tier', async () => {
  const originalEnv = new Map<string, string | undefined>();
  for (const key of CLOUD_KEYS) {
    originalEnv.set(key, process.env[key]);
    delete process.env[key];
  }

  try {
    await assert.rejects(
      () => callWithProviderFailover('No providers please.', { disableLocalFallback: true }),
      /Atlas model pool exhausted/,
    );
  } finally {
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('Atlas unified router is first when UNIFIED_ROUTER_URL is set', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = new Map<string, string | undefined>();
  for (const key of CLOUD_KEYS) {
    originalEnv.set(key, process.env[key]);
    delete process.env[key];
  }
  process.env.UNIFIED_ROUTER_URL = 'http://127.0.0.1:9999';
  process.env.UNIFIED_ROUTER_MODEL = 'atlas-council';

  const seen: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    seen.push(url);
    if (url === 'http://127.0.0.1:9999/api/chat/completions') {
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"content":"The opening stalls.","severity":"high","suggestions":["Arrive sooner."]}' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`Unexpected network call in test: ${url}`);
  }) as typeof fetch;

  try {
    const result = await callWithProviderFailover('Council critique of this draft.', {
      json: true,
      task: 'council',
      disableLocalFallback: true,
    });
    assert.equal(result.provider, 'unified');
    assert.equal(result.model, 'atlas-council');
    assert.match(result.text, /opening stalls/);
    assert.deepEqual(seen, ['http://127.0.0.1:9999/api/chat/completions']);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('strict cloud provider pin does not steal work from an explicit Grok request', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = new Map<string, string | undefined>();
  for (const key of CLOUD_KEYS) {
    originalEnv.set(key, process.env[key]);
    delete process.env[key];
  }
  process.env.UNIFIED_ROUTER_URL = 'http://127.0.0.1:9999';
  process.env.GROK_API_KEY = 'test-grok';

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('127.0.0.1:9999')) {
      throw new Error('Unified router must not be called for a strict Grok pin');
    }
    return new Response('no', { status: 401 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => callWithProviderFailover('Ping', {
        primaryProvider: 'grok',
        strictProvider: true,
        disableLocalFallback: true,
      }),
      /Grok|xAI|401|Atlas model pool exhausted/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
