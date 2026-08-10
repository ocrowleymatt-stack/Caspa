import { describe, expect, it } from 'vitest';
import { isBillingFailure, providerOrder } from '../src/services/cloudModelRouter';

describe('Atlas billing failover policy', () => {
  it('recognises quota exhaustion as a routing failure', () => {
    expect(isBillingFailure(new Error('BILLING_UNAVAILABLE: insufficient_quota'))).toBe(true);
    expect(isBillingFailure(new Error('no credits remaining'))).toBe(true);
  });

  it('keeps alternative providers after OpenAI in the route', () => {
    const order = providerOrder('openai', 'balanced', 'reasoning');
    expect(order[0]).toBe('openai');
    expect(order.length).toBeGreaterThan(1);
    expect(order.some((provider) => provider !== 'openai')).toBe(true);
  });
});
