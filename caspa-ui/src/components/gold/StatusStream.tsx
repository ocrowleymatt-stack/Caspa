import {
  passDepthOptions,
  runModeOptions,
  type PipelineStep,
  type PassDepth,
  type RunMode,
} from './types';

interface StatusStreamProps {
  steps: PipelineStep[];
  isProcessing: boolean;
  runId: string;
  selectedDepth: NonNullable<PassDepth>;
  selectedRunMode: NonNullable<RunMode>;
  selectedScopeLabel: string;
}

export default function StatusStream({
  steps,
  isProcessing,
  runId,
  selectedDepth,
  selectedRunMode,
  selectedScopeLabel,
}: StatusStreamProps) {
  return (
    <div className="bg-[#161B22] border border-slate-800/60 rounded-xl p-5 shadow-sm space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center border-b border-slate-800/40 pb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
          Pipeline Stream Execution
        </h3>
        <span
          className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
            isProcessing
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-[#0B0F19] text-slate-500 border-slate-800/50'
          }`}
        >
          {isProcessing ? 'SSE LIVE' : 'SSE IDLE'}
        </span>
      </div>

      <div className="space-y-4 relative before:absolute before:inset-0 before:left-2 before:h-full before:w-px before:bg-slate-800/60 before:z-0">
        {steps.map((step) => {
          const isPending = step.status === 'pending';
          const isRunning = step.status === 'running';
          const isDone = step.status === 'done';
          const isError = step.status === 'error';

          return (
            <div
              key={step.id}
              className="relative flex items-start gap-4 z-10 transition-all duration-300"
            >
              <div className="mt-1 relative flex h-4 w-4 items-center justify-center">
                {isDone && (
                  <div className="h-2 w-2 rounded-full bg-slate-600 border border-slate-500 shadow-sm" />
                )}
                {isPending && (
                  <div className="h-1.5 w-1.5 rounded-full bg-[#0B0F19] border border-slate-800" />
                )}
                {isRunning && (
                  <>
                    <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" />
                    <div className="relative h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_14px_rgba(217,119,6,1)]" />
                  </>
                )}
                {isError && (
                  <div className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,1)]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline gap-2">
                  <p
                    className={`text-xs font-semibold ${
                      isRunning
                        ? 'text-amber-400'
                        : isDone
                          ? 'text-slate-400'
                          : isError
                            ? 'text-rose-400'
                            : 'text-slate-600'
                    }`}
                  >
                    {step.label}
                  </p>
                  <span
                    className={`text-[9px] font-mono font-medium tracking-wider scale-90 ${
                      isRunning
                        ? 'text-amber-500'
                        : isDone
                          ? 'text-slate-600'
                          : isError
                            ? 'text-rose-400'
                            : 'text-slate-800'
                    }`}
                  >
                    {isDone ? '[DONE]' : isRunning ? '[EXEC]' : isError ? '[ERR]' : '[WAIT]'}
                  </span>
                </div>

                {isRunning && (
                  <>
                    <p className="text-[10px] text-amber-500/70 font-mono mt-0.5 leading-normal truncate animate-pulse">
                      &gt; {step.detail}
                    </p>
                    <div className="mt-2 h-1 rounded-full bg-[#0B0F19] border border-slate-900 overflow-hidden">
                      <div
                        className="h-full bg-amber-500/70 transition-all duration-500"
                        style={{ width: `${step.progress}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-800/60 pt-4 space-y-2">
        {runId && (
          <p className="text-[10px] font-mono text-slate-500">
            RUN: <span className="text-slate-300">{runId.slice(0, 24)}…</span>
          </p>
        )}
        <p className="text-[10px] font-mono text-slate-500">
          DEPTH:{' '}
          <span className="text-slate-300">
            {passDepthOptions.find((item) => item.id === selectedDepth)?.label}
          </span>
        </p>
        <p className="text-[10px] font-mono text-slate-500">
          MODE:{' '}
          <span className="text-slate-300">
            {runModeOptions.find((item) => item.id === selectedRunMode)?.label}
          </span>
        </p>
        <p className="text-[10px] font-mono text-slate-500">
          SCOPE:{' '}
          <span className="text-slate-300">{selectedScopeLabel || 'No scope selected'}</span>
        </p>
      </div>
    </div>
  );
}
