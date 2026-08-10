import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/cloudModelRouter', async () => {
  const actual = await vi.importActual<any>('../src/services/cloudModelRouter');
  return {
    ...actual,
    callCloudProvider: vi.fn(),
  };
});

import { callCloudProvider } from '../src/services/cloudModelRouter';
import { callWithProviderFailover } from '../src/services/routerFailover';

describe('Atlas provider cascade', () => {
  it('continues to the next provider after billing exhaustion', async () => {
    const mocked = vi.mocked(callCloudProvider);
    mocked.mockRejectedValueOnce(new Error('BILLING_UNAVAILABLE: insufficient_quota'));
    mocked.mockResolvedValueOnce({ text: 'fallback ok', model: 'fallback-model', provider: 'gemini' });

    const result = await callWithProviderFailover('Analyse this', {
      primaryProvider: 'openai',
      mode: 'balanced',
      task: 'reasoning',
    });

    expect(result.text).toBe('fallback ok');
    expect(result.provider).toBe('gemini');
    expect(result.attempts[0]).toMatchObject({ provider: 'openai', billingFailure: true });
    expect(mocked).toHaveBeenCalledTimes(2);
  });
});
