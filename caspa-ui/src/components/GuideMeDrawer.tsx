import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Compass, X } from 'lucide-react';
import { getGuideState } from '../api/studio';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';

const DISMISS_KEY = 'caspa-guide-dismissed';

function loadDismissed(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export function dismissGuideForProject(projectId: string) {
  const map = loadDismissed();
  map[projectId] = new Date().toISOString();
  localStorage.setItem(DISMISS_KEY, JSON.stringify(map));
}

export function GuideMeDrawer() {
  const open = useAppStore((s) => s.guideDrawerOpen);
  const setOpen = useAppStore((s) => s.setGuideDrawerOpen);
  const projectId = useAppStore((s) => s.activeProjectId);

  const { data: guide, isLoading } = useQuery({
    queryKey: ['guide-state', projectId],
    queryFn: () => getGuideState(projectId!),
    enabled: open && !!projectId,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <button
        type="button"
        aria-label="Close guide"
        className="absolute inset-0 bg-[#171a22]/55 backdrop-blur-md"
        onClick={() => setOpen(false)}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-[#eadfca] bg-[#fffdf8] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#eadfca] px-5 py-4">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-[#98711d]" />
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Guide Me</div>
              <div className="font-serif text-lg font-semibold text-[#171a22]">What next?</div>
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost p-2">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {!projectId ? (
            <div className="space-y-4 text-sm leading-6 text-muted">
              <p>Select or create a project first — then CASPA can recommend the best next step.</p>
              <Link to="/projects" className="btn-primary inline-flex" onClick={() => setOpen(false)}>
                Open Projects
              </Link>
            </div>
          ) : isLoading ? (
            <p className="text-sm text-muted">Reading project state…</p>
          ) : guide ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#eadfca] bg-[#fffaf0] p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">
                  Current state · {guide.state.replace(/-/g, ' ')}
                </div>
                <p className="mt-2 text-sm leading-6 text-[#2a2520]">{guide.recommendedNextAction.reason}</p>
                <Link
                  to={guide.recommendedNextAction.path}
                  className="btn-primary mt-4 inline-flex w-full justify-center"
                  onClick={() => setOpen(false)}
                >
                  {guide.recommendedNextAction.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {guide.warnings.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
                  {guide.warnings.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                </div>
              )}

              <div>
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Path to finished</div>
                <ul className="mt-3 space-y-2">
                  {guide.steps.map((step) => (
                    <li
                      key={step.id}
                      className={cn(
                        'rounded-xl border px-3 py-2.5 text-sm',
                        step.status === 'done' && 'border-emerald-200 bg-emerald-50/60',
                        step.status === 'recommended' && 'border-[#caa044] bg-[#fff8e8]',
                        step.status === 'missing' && 'border-amber-200 bg-amber-50/50',
                        step.status === 'optional' && 'border-[#eadfca] bg-white',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#171a22]">{step.label}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{step.status}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted">{step.explanation}</p>
                      {step.actionPath && step.status !== 'done' && (
                        <Link
                          to={step.actionPath}
                          className="mt-2 inline-flex text-xs font-bold uppercase tracking-wider text-[#98711d] hover:underline"
                          onClick={() => setOpen(false)}
                        >
                          Go →
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {guide.secondaryActions.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Also consider</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {guide.secondaryActions.map((action) => (
                      <Link
                        key={action.path}
                        to={action.path}
                        className="btn-secondary text-xs"
                        onClick={() => setOpen(false)}
                      >
                        {action.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">Could not load guide state.</p>
          )}
        </div>

        {projectId && (
          <footer className="border-t border-[#eadfca] p-4">
            <button
              type="button"
              className="btn-ghost w-full text-xs"
              onClick={() => {
                dismissGuideForProject(projectId);
                setOpen(false);
              }}
            >
              Dismiss guidance for this project
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}

export function GuideMeButton({ className }: { className?: string }) {
  const setOpen = useAppStore((s) => s.setGuideDrawerOpen);
  return (
    <button type="button" onClick={() => setOpen(true)} className={cn('btn-secondary text-xs', className)}>
      <Compass className="h-3.5 w-3.5" />
      Guide Me
    </button>
  );
}
