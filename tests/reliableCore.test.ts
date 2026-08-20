import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runAsUser } from '../src/services/requestContext';
import { createJob, getUserJob, jobSummary, listUserJobs } from '../src/services/jobQueueService';
import { projectChecksum } from '../src/services/projectRepository';

test('project checksums are stable across object key ordering', () => {
  assert.equal(projectChecksum({ b: 2, a: { z: 1, y: 2 } }), projectChecksum({ a: { y: 2, z: 1 }, b: 2 }));
});

test('jobs are user-scoped, idempotent and summaries exclude manuscript payloads', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'caspa-core-test-'));
  process.env.CASPA_DATA_DIR = dataDir;

  const alpha = runAsUser({ id: 'alpha', email: '', name: 'Alpha', groups: [] }, () => {
    const first = createJob('commission', 'queued', { idempotencyKey: 'same-click' });
    const duplicate = createJob('commission', 'queued', { idempotencyKey: 'same-click' });
    return { first, duplicate };
  });
  const beta = runAsUser({ id: 'beta', email: '', name: 'Beta', groups: [] }, () => createJob('commission'));

  assert.equal(alpha.first.id, alpha.duplicate.id);
  assert.equal(getUserJob('alpha', beta.id), null);
  assert.equal(listUserJobs('alpha').length, 1);
  assert.equal('result' in jobSummary({ ...alpha.first, result: { finalText: 'large manuscript' } }), false);
});
