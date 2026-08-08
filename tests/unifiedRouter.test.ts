import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  unifiedRouterAuthHeaders,
  unifiedRouterBase,
  unifiedRouterChatUrl,
  unifiedRouterConfigured,
  unifiedRouterModel,
} from '../src/services/unifiedRouter.ts';

describe('unifiedRouter helpers', () => {
  it('parses base and chat URL', () => {
    const env = { UNIFIED_ROUTER_URL: 'http://127.0.0.1:9999/' } as NodeJS.ProcessEnv;
    assert.equal(unifiedRouterConfigured(env), true);
    assert.equal(unifiedRouterBase(env), 'http://127.0.0.1:9999');
    assert.equal(unifiedRouterChatUrl(env), 'http://127.0.0.1:9999/api/chat/completions');
  });

  it('supports Docker bridge base', () => {
    const env = { UNIFIED_ROUTER_URL: 'http://172.18.0.1:9999' } as NodeJS.ProcessEnv;
    assert.equal(unifiedRouterChatUrl(env), 'http://172.18.0.1:9999/api/chat/completions');
  });

  it('adds bearer auth when a key is set', () => {
    const headers = unifiedRouterAuthHeaders({
      UNIFIED_ROUTER_API_KEY: 'secret',
    } as NodeJS.ProcessEnv);
    assert.equal(headers.Authorization, 'Bearer secret');
    assert.equal(unifiedRouterModel({} as NodeJS.ProcessEnv), 'llama3.2');
  });
});
