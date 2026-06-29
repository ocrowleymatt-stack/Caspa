/**
 * In-memory job queue for Gold Pipeline and quality passes (audit-friendly)
 */

import { randomUUID } from 'crypto';
import type { CaspaJobRecord, JobAuditSnapshot } from '../types/gold';

const MAX_COMPLETED = 50;
const jobs = new Map<string, CaspaJobRecord>();

export function createJob(type: CaspaJobRecord['type'], stage = 'queued'): CaspaJobRecord {
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
  return job;
}

export function updateJob(
  id: string,
  patch: Partial<Pick<CaspaJobRecord, 'status' | 'progress' | 'stage' | 'error'>>
): CaspaJobRecord | null {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  jobs.set(id, job);
  pruneCompleted();
  return job;
}

export function getJob(id: string): CaspaJobRecord | null {
  return jobs.get(id) || null;
}

function pruneCompleted(): void {
  const completed = [...jobs.values()]
    .filter((j) => j.status === 'complete' || j.status === 'failed')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (completed.length <= MAX_COMPLETED) return;
  for (const job of completed.slice(MAX_COMPLETED)) {
    jobs.delete(job.id);
  }
}

export function getJobAudit(): JobAuditSnapshot {
  const all = [...jobs.values()];
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
  };
}
