import { Check, Circle, Loader2, Lock } from 'lucide-react';
import type { MinimalStep, MinimalStepId } from '../../api/minimal';
import { cn } from '../../lib/utils';

const STEP_ICONS: Record<MinimalStep['status'], typeof Circle> = {
  done: Check,
  current: Circle,
  ready: Circle,
  locked: Lock,
};

interface MinimalStepListProps {
  steps: MinimalStep[];
  busyStep?: MinimalStepId | 'drop' | null;
  onRun?: (stepId: Exclude<MinimalStepId, 'drop'>) => void;
  disabled?: boolean;
  disabledReasons?: Partial<Record<Exclude<MinimalStepId, 'drop'>, string | undefined>>;
}

export function MinimalStepList({
  steps,
  busyStep,
  onRun,
  disabled,
  disabledReasons,
}: MinimalStepListProps) {
  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const Icon = STEP_ICONS[step.status];
        const isBusy = busyStep === step.id;
        const isAction = step.id !== 'drop';
        const actionDisabled = disabled || isBusy || step.status === 'locked';
        const reason = isAction ? disabledReasons?.[step.id as Exclude<MinimalStepId, 'drop'>] : undefined;
        const showButton = isAction && onRun;
        const canPress = showButton && !actionDisabled;

        return (
          <li
            key={step.id}
            className={cn(
              'rounded-2xl border px-4 py-3 transition',
              step.status === 'current'
                ? 'border-amber-500/40 bg-amber-500/5'
                : step.status === 'done'
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : 'border-slate-800/60 bg-[#161B22]/40',
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                  step.status === 'current' && 'border-amber-500/50 text-amber-400',
                  step.status === 'done' && 'border-emerald-500/40 text-emerald-400',
                  step.status === 'ready' && 'border-slate-600 text-slate-400',
                  step.status === 'locked' && 'border-slate-800 text-slate-600',
                )}
              >
                {isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : step.status === 'done' ? (
                  <Icon className="h-3.5 w-3.5" />
                ) : (
                  index + 1
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{step.label}</p>
                  {step.status === 'current' && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
                      Next
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{step.detail}</p>
                {reason && step.status === 'locked' && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{reason}</p>
                )}
                {showButton && (
                  <button
                    type="button"
                    disabled={!canPress}
                    onClick={() => onRun(step.id as Exclude<MinimalStepId, 'drop'>)}
                    className={cn(
                      'mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-medium transition',
                      canPress
                        ? step.status === 'current'
                          ? 'bg-white text-[#0B0F19] hover:bg-slate-100'
                          : 'border border-slate-600 bg-transparent text-slate-100 hover:border-slate-500'
                        : 'cursor-not-allowed bg-slate-800/60 text-slate-500',
                    )}
                  >
                    {isBusy ? 'Working…' : step.label}
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
