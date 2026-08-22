/**
 * Job queue with JSON persistence — survives server restarts
 */

import { randomUUID } from 'crypto';
import type { CaspaJobRecord, JobAuditSnapshot } from '../types/gold';
import { archiveJobRecord, listArchivedJobs, loadArchivedJob, loadJobStore, persistArchivedJob, persistJobStore } from './jobStoreService';
import { jobProvenance, toJobListRecord, type JobListRecord } from './jobProvenance';
import { currentProjectId, currentUser } from './requestContext';

// Large book results can be several megabytes each. Keep the active ledger small
// and archive older completed records individually without deleting user work.
const MAX_COMPLETED = 3;
const DEFAULT_STALE_ACTIVE_MS = 12 * 60 * 60 * 1000;

function store(): Map<string, CaspaJobRecord> {
  return loadJobStore();
}

function save(jobs: Map<string, CaspaJobRecord>): void {
  persistJobStore(jobs);
}

export function createJob(type: CaspaJobRecord['type'], stage = 'queued', options: { projectId?: string; idempotencyKey?: string } = {}): CaspaJobRecord {
  const jobs = store();
  const userId = currentUser()?.id || 'legacy-owner';
  if (options.idempotencyKey) {
    const existing = [...jobs.values()].find((item) => item.userId === userId && item.idempotencyKey === options.idempotencyKey);
    if (existing) return existing;
  }
  const now = new Date().toISOString();
  const job: CaspaJobRecord = {
    id: randomUUID(),
    userId,
    projectId: options.projectId || currentProjectId(),
    idempotencyKey: options.idempotencyKey,
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
  patch: Partial<Pick<CaspaJobRecord, 'status' | 'progress' | 'stage' | 'error' | 'result' | 'input' | 'checkpoint' | 'projectId'>>
): CaspaJobRecord | null {
  const jobs = store();
  const job = jobs.get(id);
  if (job) {
    Object.assign(job, patch, { updatedAt: new Date().toISOString() });
    jobs.set(id, job);
    pruneCompleted(jobs);
    save(jobs);
    return job;
  }
  const archived = loadArchivedJob(id);
  if (!archived) return null;
  Object.assign(archived, patch, { updatedAt: new Date().toISOString() });
  persistArchivedJob(archived);
  return archived;
}

export function getJob(id: string): CaspaJobRecord | null {
  return store().get(id) || loadArchivedJob(id);
}

export function listRecentJobs(limit = 20): CaspaJobRecord[] {
  return [...store().values()]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export function jobSummary(job: CaspaJobRecord & Partial<JobListRecord>): JobListRecord {
  return toJobListRecord(job);
}

export { jobProvenance };

export function getUserJob(userId: string, id: string): CaspaJobRecord | null {
  const job = getJob(id);
  if (!job || (job.userId || 'legacy-owner') !== userId) return null;
  return job;
}

export function jobMatchesProject(job: { projectId?: string }, projectId?: string): boolean {
  if (!projectId) return true;
  return Boolean(job.projectId) && job.projectId === projectId;
}

export function assertJobBoundToProject(job: { projectId?: string }, projectId: string): void {
  if (!job.projectId || job.projectId !== projectId) {
    const error = new Error('This completed job is not assigned to the open project. Assign it first. Nothing was written.');
    (error as Error & { code: string }).code = 'JOB_PROJECT_MISMATCH';
    throw error;
  }
}

export function bindJobToProject(jobId: string, projectId: string): CaspaJobRecord {
  const job = getJob(jobId);
  if (!job) {
    const error = new Error('Job not found.');
    (error as Error & { code: string }).code = 'JOB_NOT_FOUND';
    throw error;
  }
  if (job.projectId && job.projectId !== projectId) {
    assertJobBoundToProject(job, projectId);
  }
  if (job.projectId === projectId) return job;
  const updated = updateJob(jobId, { projectId });
  if (!updated?.projectId || updated.projectId !== projectId) {
    const error = new Error('Could not assign this job to the project. Nothing was written.');
    (error as Error & { code: string }).code = 'JOB_BIND_FAILED';
    throw error;
  }
  return updated;
}

export function listUserJobs(userId: string, limit = 20, projectId?: string, status?: string, unboundOnly = false): Array<CaspaJobRecord | JobListRecord> {
  const active = listRecentJobs(500);
  const seen = new Set(active.map((job) => job.id));
  const archived = listArchivedJobs().filter((job) => !seen.has(job.id));
  return [...active, ...archived]
    .filter((job) => (job.userId || 'legacy-owner') === userId)
    .filter((job) => unboundOnly ? !job.projectId : jobMatchesProject(job, projectId))
    .filter((job) => !status || job.status === status)
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
  const sizeBeforeMaintenance = jobs.size;
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

  // Startup maintenance also compacts legacy oversized ledgers even when
  // there are no zombie active jobs to reap.
  pruneCompleted(jobs);
  if (reaped || jobs.size !== sizeBeforeMaintenance) {
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
    archiveJobRecord(job);
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
