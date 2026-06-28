import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  cancelCaspaJob,
  getCaspaJob,
  getJobProgress,
  retryCaspaJob,
  type CaspaJob,
  type JobProgress,
} from '../api/caspaJobs';

export function useCaspaJobTracker(jobId: string | null | undefined) {
  const [progress, setProgress] = useState<JobProgress | null>(null);

  const { data: job, refetch, isFetching } = useQuery({
    queryKey: ['caspa-job', jobId],
    queryFn: () => getCaspaJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ['queued', 'running', 'partial', 'waiting'].includes(status) ? 2000 : false;
    },
  });

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await getJobProgress(jobId);
        if (!cancelled) setProgress(next);
      } catch {
        // ignore transient poll errors
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [jobId]);

  const cancel = useCallback(async () => {
    if (!jobId) return null;
    await cancelCaspaJob(jobId);
    return refetch();
  }, [jobId, refetch]);

  const retry = useCallback(async () => {
    if (!jobId) return null;
    await retryCaspaJob(jobId);
    return refetch();
  }, [jobId, refetch]);

  return { job, progress, refetch, isFetching, cancel, retry };
}

export function jobTitle(job: CaspaJob | null | undefined): string {
  if (!job) return 'Background job';
  if (job.type === 'novel-write-pro') return 'Novel Write Pro';
  if (job.type === 'gold-pass') return 'Gold Pass';
  if (job.type === 'gold-pipeline') return 'Gold Pipeline';
  if (job.type === 'agent-swarm') return 'Agent Swarm';
  if (job.type === 'minimal-auto-build') return 'Auto Build';
  if (job.type === 'minimal-auto-write') return 'Auto Write';
  if (job.type === 'minimal-improve') return 'Improve';
  if (job.type === 'project-bible') return 'Project Bible';
  if (job.type === 'book-map') return 'Book Map';
  if (job.type === 'cut-analyse') return 'Cut / Tighten analysis';
  return job.type.replace(/-/g, ' ');
}
