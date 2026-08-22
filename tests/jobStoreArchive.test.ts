import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'caspa-job-store-'));
process.env.CASPA_DATA_DIR = dataDir;

const { bindJobToProject, createJob, getJob, listUserJobs, updateJob } = await import('../src/services/jobQueueService');

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

test('archived job assignment persists and then matches only that project', () => {
  const first = createJob('commission');
  updateJob(first.id, { status: 'complete', progress: 100, result: { finalText: 'unbound archive' } });

  for (let index = 0; index < 5; index += 1) {
    const job = createJob('commission', 'queued', { projectId: 'proj-other' });
    updateJob(job.id, { status: 'complete', progress: 100, result: { finalText: `bound-${index}` } });
  }

  const archiveFile = path.join(dataDir, 'caspa-job-archive', `${first.id}.json`);
  assert.ok(fs.existsSync(archiveFile));
  assert.equal(JSON.parse(fs.readFileSync(archiveFile, 'utf8')).projectId, undefined);
  assert.equal(listUserJobs(first.userId || 'legacy-owner', 20, 'proj-harbour').some((job) => job.id === first.id), false);
  assert.equal(listUserJobs(first.userId || 'legacy-owner', 20, undefined, 'complete', true).some((job) => job.id === first.id), true);

  const bound = bindJobToProject(first.id, 'proj-harbour');
  assert.equal(bound.projectId, 'proj-harbour');
  assert.equal(JSON.parse(fs.readFileSync(archiveFile, 'utf8')).projectId, 'proj-harbour');
  assert.equal(getJob(first.id)?.projectId, 'proj-harbour');
  assert.equal(listUserJobs(bound.userId, 20, 'proj-harbour').some((job) => job.id === first.id), true);
  assert.equal(listUserJobs(bound.userId, 20, 'proj-other').some((job) => job.id === first.id), false);
  assert.equal(listUserJobs(bound.userId, 20, undefined, 'complete', true).some((job) => job.id === first.id), false);
});
