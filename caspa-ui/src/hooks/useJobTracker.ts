import { useEffect } from 'react';
import { getJob, subscribeToJob } from '../api/jobs';
import { useAppStore } from '../store';
import type { JobStatus } from '../types';

export function useJobTracker(
  jobId: string | null,
  fetchJob: (id: string) => Promise<JobStatus> = getJob,
  options?: { sse?: boolean; pollMs?: number },
) {
  const upsertJob = useAppStore((s) => s.upsertJob);
  const jobs = useAppStore((s) => s.jobs);
  const sse = options?.sse ?? true;
  const pollMs = options?.pollMs ?? 2000;

  const job = jobId ? jobs.find((j) => j.id === jobId) : null;

  useEffect(() => {
    if (!jobId) return;

    let source: EventSource | null = null;
    if (sse) {
      source = subscribeToJob(jobId, (update) => {
        upsertJob({
          id: jobId,
          type: update.type ?? 'job',
          status: update.status ?? 'running',
          progress: update.progress ?? 0,
          createdAt: update.createdAt ?? new Date().toISOString(),
          updatedAt: update.updatedAt ?? new Date().toISOString(),
          ...update,
        });
      });
    }

    const poll = async () => {
      try {
        const latest = await fetchJob(jobId);
        upsertJob(latest);
        return latest.status === 'complete' || latest.status === 'failed';
      } catch {
        return false;
      }
    };

    void poll();
    const interval = setInterval(async () => {
      const done = await poll();
      if (done) clearInterval(interval);
    }, pollMs);

    return () => {
      source?.close();
      clearInterval(interval);
    };
  }, [jobId, fetchJob, upsertJob, sse, pollMs]);

  return job;
}
