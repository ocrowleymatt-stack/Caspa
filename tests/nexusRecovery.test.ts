import assert from 'node:assert/strict';
import test from 'node:test';

import { callWithNexusRecovery, reportNexusIncident } from '../src/services/nexusRecovery';

const env = {
  ...process.env,
  NEXUS_RECOVERY_URL: 'http://127.0.0.1:43101/internal/recovery/incidents',
  NEXUS_RECOVERY_DISABLED: 'false',
};

test('reportNexusIncident returns the recovery plan supplied by Nexus', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    incident: {
      id: 'incident-1',
      source: 'caspa',
      operation: 'router.cloud.gemini',
      error: '504 gateway timeout',
      kind: 'transient-network',
      action: 'retry',
      retryable: true,
      delayMs: 0,
      attempt: 1,
      requiresHuman: false,
      instructions: ['retry'],
      createdAt: new Date().toISOString(),
    },
  }), { status: 201, headers: { 'Content-Type': 'application/json' } });

  try {
    const incident = await reportNexusIncident(new Error('504 gateway timeout'), {
      operation: 'router.cloud.gemini',
      safeToRetry: true,
    }, env);
    assert.equal(incident?.retryable, true);
    assert.equal(incident?.action, 'retry');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('callWithNexusRecovery retries once only when Nexus classifies the incident retryable', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    incident: {
      id: 'incident-2',
      source: 'caspa',
      operation: 'router.unified',
      error: 'ETIMEDOUT',
      kind: 'timeout',
      action: 'retry',
      retryable: true,
      delayMs: 0,
      attempt: 1,
      requiresHuman: false,
      instructions: ['retry'],
      createdAt: new Date().toISOString(),
    },
  }), { status: 201, headers: { 'Content-Type': 'application/json' } });

  let calls = 0;
  try {
    const value = await callWithNexusRecovery(async () => {
      calls += 1;
      if (calls === 1) throw new Error('ETIMEDOUT');
      return 'recovered';
    }, {
      operation: 'router.unified',
      safeToRetry: true,
    }, env);

    assert.equal(value, 'recovered');
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('callWithNexusRecovery does not repeat unsafe operations', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    incident: {
      id: 'incident-3',
      source: 'caspa',
      operation: 'publish',
      error: 'ETIMEDOUT',
      kind: 'timeout',
      action: 'diagnose',
      retryable: false,
      delayMs: 0,
      attempt: 1,
      requiresHuman: false,
      instructions: ['inspect state'],
      createdAt: new Date().toISOString(),
    },
  }), { status: 201, headers: { 'Content-Type': 'application/json' } });

  let calls = 0;
  try {
    await assert.rejects(() => callWithNexusRecovery(async () => {
      calls += 1;
      throw new Error('ETIMEDOUT');
    }, {
      operation: 'publish',
      safeToRetry: false,
    }, env));
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
