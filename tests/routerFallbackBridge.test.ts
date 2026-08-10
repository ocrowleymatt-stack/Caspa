import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/routerFailover', () => ({
  callWithProviderFailover: vi.fn(async () => ({
    text: 'ok',
    model: 'model-x',
    provider: 'gemini',
    attempts: [],
  })),
}));

import { routeAtlasPrompt } from '../src/services/routerFallbackBridge';

describe('routeAtlasPrompt', () => {
  it('uses the canonical failover router', async () => {
    const result = await routeAtlasPrompt('hello');
    expect(result.text).toBe('ok');
    expect(result.provider).toBe('gemini');
  });
});
