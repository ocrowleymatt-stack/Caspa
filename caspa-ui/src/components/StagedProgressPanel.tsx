import { Link } from 'react-router-dom';
import { StagedProgress } from './StagedProgress';
import { useStagedProgress } from '../hooks/useStagedProgress';

interface StagedProgressPanelProps {
  label: string;
  stages: string[];
  pending: boolean;
  provider?: string;
  model?: string;
  outputId?: string;
  error?: string | null;
  advanceEveryMs?: number;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function StagedProgressPanel({
  label,
  stages,
  pending,
  provider,
  model,
  outputId,
  error,
  advanceEveryMs,
}: StagedProgressPanelProps) {
  const { activeStage, elapsedSeconds } = useStagedProgress(stages, pending, advanceEveryMs);

  if (error) {
    return (
      <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-5 text-sm text-red-900">
        <div className="font-semibold">{label} failed</div>
        <p className="mt-2 leading-7">{error}</p>
        <p className="mt-2 text-xs opacity-80">
          Try again, check AI engine status on Today, or wait if local Ollama is busy.
        </p>
      </div>
    );
  }

  if (!pending && !outputId) return null;

  return (
    <div className="space-y-3">
      {pending && (
        <>
          <StagedProgress label={label} stages={stages} activeStage={activeStage} pending />
          <div className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 text-xs leading-6 text-[#5f5648]">
            <p>
              <strong className="text-[#171a22]">Elapsed:</strong> {formatElapsed(elapsedSeconds)}
              {provider && (
                <>
                  {' '}
                  · <strong className="text-[#171a22]">Engine:</strong> {provider}
                  {model ? ` / ${model}` : ''}
                </>
              )}
            </p>
            <p className="mt-1">Local Ollama can take several minutes. The stage list shows honest progress — not a fake percentage.</p>
          </div>
        </>
      )}
      {outputId && !pending && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Saved to Saved Writing ·{' '}
          <Link to={`/outputs/${outputId}`} className="font-semibold underline">
            Open output
          </Link>
        </div>
      )}
    </div>
  );
}
