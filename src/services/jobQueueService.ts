/**
 * Job queue with JSON persistence — survives server restarts
 */

import { randomUUID } from 'crypto';
import type { CaspaJobRecord, JobAuditSnapshot } from '../types/gold';
import { loadJobStore, persistJobStore } from './jobStoreService';

const MAX_COMPLETED = 100;
const DEFAULT_STALE_ACTIVE_MS = 12 * 60 * 60 * 1000;

function store(): Map<string, CaspaJobRecord> {
  return loadJobStore();
}

function save(jobs: Map<string, CaspaJobRecord>): void {
  persistJobStore(jobs);
}

export function createJob(type: CaspaJobRecord['type'], stage = 'queued'): CaspaJobRecord {
  const jobs = store();
  const now = new Date().toISOString();
  const job: CaspaJobRecord = {
    id: randomUUID(),
    type,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    progress: 0,
    stage,
  };
  jobs.set(job.id, job);
  save(jobs);
  return job;
}

export function updateJob(
  id: string,
  patch: Partial<Pick<CaspaJobRecord, 'status' | 'progress' | 'stage' | 'error' | 'result' | 'input' | 'checkpoint'>>
): CaspaJobRecord | null {
  const jobs = store();
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  jobs.set(id, job);
  pruneCompleted(jobs);
  save(jobs);
  return job;
}

export function getJob(id: string): CaspaJobRecord | null {
  return store().get(id) || null;
}

export function listRecentJobs(limit = 20): CaspaJobRecord[] {
  return [...store().values()]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

/**
 * Clear zombie jobs left behind by legacy workers/restarts only when they are
 * genuinely unrecoverable: queued/running, untouched for a long period, and
 * carrying neither resumable input nor a checkpoint. Jobs with either input or
 * a checkpoint are deliberately preserved for their owning recovery path.
 */
export function reapStaleJobs(maxAgeMs = DEFAULT_STALE_ACTIVE_MS): number {
  const jobs = store();
  const now = Date.now();
  const stamp = new Date().toISOString();
  let reaped = 0;

  for (const job of jobs.values()) {
    if (job.status !== 'queued' && job.status !== 'running') continue;
    if (job.input || job.checkpoint) continue;
    const updated = new Date(job.updatedAt || job.createdAt).getTime();
    if (!Number.isFinite(updated) || now - updated < maxAgeMs) continue;

    job.status = 'failed';
    job.stage = 'stale-reaped';
    job.error = `Stale persisted job cleared after ${Math.round((now - updated) / 3_600_000)} hours with no resumable input or checkpoint.`;
    job.updatedAt = stamp;
    jobs.set(job.id, job);
    reaped += 1;
  }

  if (reaped) {
    pruneCompleted(jobs);
    save(jobs);
  }
  return reaped;
}

function pruneCompleted(jobs: Map<string, CaspaJobRecord>): void {
  const completed = [...jobs.values()]
    .filter((j) => j.status === 'complete' || j.status === 'failed')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (completed.length <= MAX_COMPLETED) return;
  for (const job of completed.slice(MAX_COMPLETED)) {
    jobs.delete(job.id);
  }
}

export function getJobAudit(): JobAuditSnapshot {
  const all = [...store().values()];
  const active = all.filter((j) => j.status === 'queued' || j.status === 'running');
  const completed = all.filter((j) => j.status === 'complete');
  const failed = all.filter((j) => j.status === 'failed');

  let oldestActiveAgeMs: number | null = null;
  if (active.length) {
    const oldest = active.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
    oldestActiveAgeMs = Date.now() - new Date(oldest.createdAt).getTime();
  }

  return {
    activeJobs: active.length,
    completedJobs: completed.length,
    failedJobs: failed.length,
    queueDepth: active.filter((j) => j.status === 'queued').length,
    oldestActiveAgeMs,
    persisted: true,
  };
}