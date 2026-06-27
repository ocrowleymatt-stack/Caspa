import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { getLatestProjectJob, resumeCaspaJob, type CaspaJob, type CaspaJobStage } from '../api/caspaJobs';
import { useToast } from './Toast';

function jobSummary(job: CaspaJob): string {
  const stage = job.stages.find((s: CaspaJobStage) => s.id === job.currentStage);
  if (job.status === 'partial') {
    return job.error ?? `Stopped during ${stage?.label ?? 'processing'}`;
  }
  if (job.status === 'running') {
    return `Running ${stage?.label ?? job.type}`;
  }
  return `${job.type} · ${job.status}`;
}

export function JobRecoveryBanner({ projectId }: { projectId: string }) {
  const toast = useToast();
  const { data: job, refetch, isFetching } = useQuery({
    queryKey: ['caspa-job-latest', projectId],
    queryFn: () => getLatestProjectJob(projectId),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const latest = query.state.data;
      return latest?.status === 'running' ? 3000 : false;
    },
  });

  if (!job || !['partial', 'running', 'queued', 'needs-review'].includes(job.status)) {
    return null;
  }

  const resume = async () => {
    if (!job) return;
    try {
      await resumeCaspaJob(job.id);
      await refetch();
      toast.success('Job resume started — check Writing History for new output');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not resume job');
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="font-medium">Long operation {job.status === 'running' ? 'in progress' : 'needs attention'}</p>
            <p className="mt-1 text-xs text-amber-200/80 font-mono">{jobSummary(job)}</p>
            {job.status === 'partial' && job.error ? (
              <p className="mt-1 text-xs text-amber-200/70">{job.error}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {job.status === 'partial' ? (
            <button
              type="button"
              onClick={resume}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-[#0B0F19] px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Resume job
            </button>
          ) : null}
          <Link
            to={`/outputs?projectId=${projectId}`}
            className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/10"
          >
            Check Writing History
          </Link>
        </div>
      </div>
    </div>
  );
}
