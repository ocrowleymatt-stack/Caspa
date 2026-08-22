import assert from 'node:assert/strict';
import test from 'node:test';
import { getDoctorSnapshot, publicDoctorView } from '../src/services/doctorService';

test('public doctor status is coarse and omits topology', async () => {
  const snapshot = await getDoctorSnapshot();
  const published = publicDoctorView(snapshot);
  assert.ok(published.status === 'ok' || published.status === 'degraded');
  assert.equal(typeof published.ready, 'boolean');
  const raw = JSON.stringify(published);
  assert.doesNotMatch(raw, /gitSha|UNIFIED_ROUTER|127\.0\.0\.1:9999|aiProviders|jobs|storage|gitBranch|backupCount/);
  assert.equal((published as { gitSha?: string }).gitSha, undefined);
  assert.equal((snapshot.aiProviders.unifiedRouter as { base?: string }).base, undefined);
});
