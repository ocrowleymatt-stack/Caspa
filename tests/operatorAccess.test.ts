import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOpsGroups, userIsOperator } from '../src/middleware/authenticatedUser';
import { getBuildStamp, resetBuildInfoCache } from '../src/services/buildInfoService';
import { publicHealthPayload } from '../src/services/publicHealth';

test('operator groups fail closed unless CASPA_OPS_GROUPS is set', () => {
  const previous = process.env.CASPA_OPS_GROUPS;
  delete process.env.CASPA_OPS_GROUPS;
  try {
    assert.deepEqual(parseOpsGroups(), []);
    assert.equal(userIsOperator({ groups: ['admin'] }), false);
    assert.equal(userIsOperator({ groups: ['ops'] }), false);
    assert.equal(userIsOperator({ groups: ['authentik Admins'] }), false);
  } finally {
    if (previous === undefined) delete process.env.CASPA_OPS_GROUPS;
    else process.env.CASPA_OPS_GROUPS = previous;
  }
});

test('operator groups are matched case-insensitively against Authentik groups', () => {
  const previous = process.env.CASPA_OPS_GROUPS;
  process.env.CASPA_OPS_GROUPS = 'authentik Admins,caspa-ops';
  try {
    assert.deepEqual(parseOpsGroups(), ['authentik admins', 'caspa-ops']);
    assert.equal(userIsOperator({ groups: ['writers', 'authentik Admins'] }), true);
    assert.equal(userIsOperator({ groups: ['CASPA-OPS'] }), true);
    assert.equal(userIsOperator({ groups: ['admin'] }), false);
    assert.equal(userIsOperator({ groups: ['writers'] }), false);
    assert.equal(userIsOperator({ groups: [] }), false);
    assert.equal(userIsOperator(undefined), false);
  } finally {
    if (previous === undefined) delete process.env.CASPA_OPS_GROUPS;
    else process.env.CASPA_OPS_GROUPS = previous;
  }
});

test('public health payload is coarse', () => {
  const payload = publicHealthPayload();
  assert.deepEqual(payload, { status: 'ok' });
  const raw = JSON.stringify(payload);
  assert.doesNotMatch(raw, /gitSha|builtAt|uptime|"env"|NODE_ENV/);
});

test('build stamp is opaque and stable for the same fingerprint', () => {
  resetBuildInfoCache();
  const first = getBuildStamp();
  const second = getBuildStamp();
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{16}$/);
  assert.doesNotMatch(first, /unknown/);
});
