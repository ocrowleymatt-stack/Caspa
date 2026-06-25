import { Loader2, X } from 'lucide-react';
import type { JobStatus } from '../types';
import { cn, formatDate } from '../lib/utils';

const statusStyles: Record<JobStatus['status'], string> = {
  queued: 'bg-slate-500/20 text-slate-300',
  running: 'bg-blue-500/20 text-blue-300',
  complete: 'bg-emerald-500/20 text-emerald-300',
  failed: 'bg-red-500/20 text-red-300',
};

interface JobProgressCardProps {
  job: JobStatus;
  onCancel?: (id: string) => void;
  compact?: boolean;
}

export function JobProgressCard({ job, onCancel, compact }: JobProgressCardProps) {
  const canCancel = job.status === 'queued' || job.status === 'running';

  return (
    <div className={cn('card', compact && 'p-3')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{job.type}</span>
            <span className={cn('badge capitalize', statusStyles[job.status])}>{job.status}</span>
          </div>
          {!compact && (
            <p className="mt-1 text-xs text-muted">
              Created {formatDate(job.createdAt)}
            </p>
          )}
        </div>
        {canCancel && onCancel && (
          <button
            type="button"
            onClick={() => onCancel(job.id)}
            className="btn-ghost p-1.5"
            title="Cancel job"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {(job.status === 'running' || job.status === 'queued') && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted mb-1">
            <span className="flex items-center gap-1">
              {job.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
              Progress
            </span>
            <span>{job.progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      )}

      {job.status === 'failed' && job.error && (
        <p className="mt-2 text-xs text-red-400">{job.error}</p>
      )}
    </div>
  );
}
