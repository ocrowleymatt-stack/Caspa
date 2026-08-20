import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'caspa-job-store-'));
process.env.CASPA_DATA_DIR = dataDir;

const { createJob, getJob, updateJob } = await import('../src/services/jobQueueService');

test('older completed jobs are archived losslessly and remain retrievable', () => {
  const first = createJob('commission');
  updateJob(first.id, { status: 'complete', progress: 100, result: { finalText: 'retained manuscript' } });

  for (let index = 0; index < 41; index += 1) {
    const job = createJob('commission');
    updateJob(job.id, { status: 'complete', progress: 100, result: { finalText: `book-${index}` } });
  }

  const restored = getJob(first.id);
  assert.equal(restored?.result?.finalText, 'retained manuscript');
  assert.ok(fs.existsSync(path.join(dataDir, 'caspa-job-archive', `${first.id}.json`)));

  const active = JSON.parse(fs.readFileSync(path.join(dataDir, 'caspa-jobs.json'), 'utf8'));
  assert.equal(active.jobs.filter((job: any) => job.status === 'complete').length, 3);
  assert.ok(active.jobs.every((job: any) => !job.result && !job.input && !job.checkpoint));
  assert.ok(fs.existsSync(path.join(dataDir, 'caspa-job-records')));
});
