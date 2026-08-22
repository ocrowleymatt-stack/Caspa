import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'caspa-job-store-'));
process.env.CASPA_DATA_DIR = dataDir;

const { bindJobToProject, createJob, getJob, jobSummary, listUserJobs, updateJob } = await import('../src/services/jobQueueService');
const { listArchivedJobs, migrateLegacyArchiveMeta } = await import('../src/services/jobStoreService');

test('older completed jobs are archived losslessly and remain retrievable', () => {
  const first = createJob('commission');
  updateJob(first.id, { status: 'complete', progress: 100, result: { finalText: 'retained manuscript' } });

  for (let index = 0; index < 41; index += 1) {
    const job = createJob('commission');
    updateJob(job.id, { status: 'complete', progress: 100, result: { finalText: `book-${index}` } });
  }

  const restored = getJob(first.id);
  assert.equal(restored?.result?.finalText, 'retained manuscript');
  const archiveFile = path.join(dataDir, 'caspa-job-archive', `${first.id}.json`);
  const metaFile = path.join(dataDir, 'caspa-job-archive', `${first.id}.meta.json`);
  assert.ok(fs.existsSync(archiveFile));
  assert.ok(fs.existsSync(metaFile));
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  assert.equal(meta.result, undefined);
  assert.equal(meta.provenance?.wordCount, 2);
  assert.match(String(meta.provenance?.checksum || ''), /^[a-f0-9]{64}$/);

  const active = JSON.parse(fs.readFileSync(path.join(dataDir, 'caspa-jobs.json'), 'utf8'));
  assert.equal(active.jobs.filter((job: any) => job.status === 'complete').length, 3);
  assert.ok(active.jobs.every((job: any) => !job.result && !job.input && !job.checkpoint));
  assert.ok(fs.existsSync(path.join(dataDir, 'caspa-job-records')));

  fs.renameSync(archiveFile, `${archiveFile}.hidden`);
  const listed = listUserJobs(first.userId || 'legacy-owner', 50, undefined, 'complete');
  const listedJob = listed.find((job) => job.id === first.id) as { result?: unknown; provenance?: { excerpt?: string } } | undefined;
  assert.ok(listedJob);
  assert.equal(listedJob.result, undefined);
  assert.equal(listedJob.provenance?.excerpt, 'retained manuscript');
  assert.ok(listArchivedJobs().every((job) => !('result' in job) || !(job as { result?: unknown }).result));
  fs.renameSync(`${archiveFile}.hidden`, archiveFile);
});

test('archived job assignment persists and then matches only that project', () => {
  const first = createJob('commission');
  updateJob(first.id, {
    status: 'complete',
    progress: 100,
    input: { brief: { title: 'Tide Tables', idea: 'A clerk keeps the tide' } },
    result: { finalText: 'unbound archive', words: 2, project: { title: 'Tide Tables', idea: 'A clerk keeps the tide' } },
  });

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
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'caspa-job-archive', `${first.id}.meta.json`), 'utf8')).projectId, 'proj-harbour');
  assert.equal(jobSummary(bound).provenance?.title, 'Tide Tables');
  assert.equal(getJob(first.id)?.projectId, 'proj-harbour');
  assert.equal(listUserJobs(bound.userId, 20, 'proj-harbour').some((job) => job.id === first.id), true);
  assert.equal(listUserJobs(bound.userId, 20, 'proj-other').some((job) => job.id === first.id), false);
  assert.equal(listUserJobs(bound.userId, 20, undefined, 'complete', true).some((job) => job.id === first.id), false);
});

test('legacy archives receive sidecar metadata without rewriting the manuscript', () => {
  const archive = path.join(dataDir, 'caspa-job-archive');
  fs.mkdirSync(archive, { recursive: true });
  const job = {
    id: 'legacy-finish-1',
    userId: 'legacy-owner',
    type: 'commission' as const,
    status: 'complete' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    progress: 100,
    stage: 'complete',
    input: { brief: { title: 'Harbour Book', idea: 'A clerk keeps the tide' } },
    result: { finalText: 'historical harbour manuscript', words: 3, project: { title: 'Harbour Book', idea: 'A clerk keeps the tide' } },
  };
  const full = path.join(archive, `${job.id}.json`);
  const meta = path.join(archive, `${job.id}.meta.json`);
  const raw = JSON.stringify(job);
  fs.writeFileSync(full, raw);
  assert.equal(fs.existsSync(meta), false);

  const listed = listArchivedJobs();
  assert.ok(listed.some((item) => item.id === job.id && item.provenance?.title === 'Harbour Book'));
  assert.ok(fs.existsSync(meta));
  assert.equal(fs.readFileSync(full, 'utf8'), raw);
  assert.equal(JSON.parse(fs.readFileSync(meta, 'utf8')).result, undefined);

  const again = migrateLegacyArchiveMeta();
  assert.equal(again.migrated, 0);
  assert.equal(fs.readFileSync(full, 'utf8'), raw);

  const other = {
    ...job,
    id: 'legacy-finish-2',
    result: { finalText: 'second harbour book', words: 3, project: { title: 'Tide Tables' } },
  };
  const otherFull = path.join(archive, `${other.id}.json`);
  fs.writeFileSync(otherFull, JSON.stringify(other));
  const resumed = migrateLegacyArchiveMeta();
  assert.equal(resumed.migrated, 1);
  assert.ok(fs.existsSync(path.join(archive, `${other.id}.meta.json`)));
  assert.equal(JSON.parse(fs.readFileSync(otherFull, 'utf8')).result.finalText, 'second harbour book');
  assert.equal(listUserJobs('legacy-owner', 50, undefined, 'complete').some((item) => item.id === job.id), true);
});
