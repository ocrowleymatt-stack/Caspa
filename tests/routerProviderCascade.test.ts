import assert from 'node:assert/strict';
import test from 'node:test';
import { isBillingFailure, providerOrder } from '../src/services/cloudModelRouter';

test('billing exhaustion remains a failover-class error', () => {
  assert.equal(isBillingFailure(new Error('BILLING_UNAVAILABLE: insufficient_quota')), true);
});

test('provider cascade retains viable alternatives after an explicit primary', () => {
  const order = providerOrder('openai', 'balanced', 'reasoning');
  assert.equal(order[0], 'openai');
  assert.ok(order.slice(1).some((provider) => provider !== 'openai'));
  assert.ok(order.includes('gemini'));
  assert.ok(order.includes('venice'));
});
