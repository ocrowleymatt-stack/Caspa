import assert from 'node:assert/strict';
import test from 'node:test';
import { isBillingFailure, providerOrder } from '../src/services/cloudModelRouter';

test('recognises quota exhaustion as a routing failure', () => {
  assert.equal(isBillingFailure(new Error('BILLING_UNAVAILABLE: insufficient_quota')), true);
  assert.equal(isBillingFailure(new Error('no credits remaining')), true);
});

test('keeps alternative providers after OpenAI in the route', () => {
  const order = providerOrder('openai', 'balanced', 'reasoning');
  assert.equal(order[0], 'openai');
  assert.ok(order.length > 1);
  assert.ok(order.some((provider) => provider !== 'openai'));
});
