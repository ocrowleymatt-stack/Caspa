import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { jobTitle, useCaspaJobTracker } from '../hooks/useCaspaJobTracker';
import { cn } from '../lib/utils';

interface JobProgressPanelProps {
  jobId: string | null;
  projectId?: string;
  className?: string;
  onComplete?: (outputId?: string) => void;
}

function elapsedLabel(startedAt?: string) {
  if (!startedAt) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function JobProgressPanel({ jobId, projectId, className, onComplete }: JobProgressPanelProps) {
  const { job, progress, cancel, retry, isFetching } = useCaspaJobTracker(jobId);

  if (!jobId || !job) return null;

  const pct = progress?.progress ?? 0;
  const failed = job.status === 'failed' || job.status === 'cancelled';
  const done = job.status === 'completed';
  const running = ['queued', 'running', 'waiting', 'partial'].includes(job.status);
  const outputId = typeof job.result?.outputId === 'string' ? job.result.outputId : undefined;

  useEffect(() => {
    if (done && onComplete) {
      onComplete(outputId);
    }
  }, [done, onComplete, outputId]);

  return (
    <section
      className={cn(
        'rounded-2xl border px-4 py-4',
        done
          ? 'border-emerald-500/30 bg-emerald-500/10'
          : failed
            ? 'border-red-500/30 bg-red-500/10'
            : 'border-amber-500/30 bg-amber-500/10',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{jobTitle(job)}</p>
          <p className="mt-1 text-xs text-slate-400">
            {running
              ? 'CASPA is still working on this in the background — you can leave this page and return.'
              : done
                ? 'Complete — open the saved result when ready.'
                : job.error ?? 'This job needs attention.'}
          </p>
        </div>
        {running ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-400" />
        ) : done ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
        ) : (
          <XCircle className="h-4 w-4 shrink-0 text-red-400" />
        )}
      </div>

      {running && (
        <>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
            <span>{job.currentStage ? `Stage: ${job.stages.find((s) => s.id === job.currentStage)?.label ?? job.currentStage}` : 'Queued'}</span>
            <span>{pct}% · {elapsedLabel(job.startedAt)}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${Math.max(pct, 6)}%` }} />
          </div>
          <ol className="mt-4 space-y-1">
            {job.stages.map((stage, index) => (
              <li key={stage.id} className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="w-4 font-mono text-slate-500">{index + 1}.</span>
                <span className={cn(stage.status === 'completed' && 'text-emerald-300', stage.status === 'running' && 'text-amber-200')}>
                  {stage.label}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}

      {typeof progress?.partialResult === 'object' && progress.partialResult !== null && (
        <pre className="mt-3 max-h-24 overflow-y-auto rounded-lg bg-[#0B0F19]/60 p-2 text-[10px] text-slate-400">
          {JSON.stringify(progress.partialResult, null, 2)}
        </pre>
      )}

      {failed && job.error && (
        <p className="mt-3 inline-flex items-start gap-2 text-xs text-red-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {job.error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {running && (
          <button
            type="button"
            disabled={isFetching}
            onClick={() => void cancel()}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600"
          >
            Cancel
          </button>
        )}
        {failed && (
          <button
            type="button"
            disabled={isFetching}
            onClick={() => void retry()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/10"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Retry
          </button>
        )}
        {outputId && (
          <Link
            to={`/outputs/${outputId}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-[#0B0F19] hover:bg-slate-100"
          >
            Open result <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
        {projectId && (
          <Link
            to={`/outputs?projectId=${projectId}`}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600"
          >
            Writing History
          </Link>
        )}
      </div>
    </section>
  );
}
