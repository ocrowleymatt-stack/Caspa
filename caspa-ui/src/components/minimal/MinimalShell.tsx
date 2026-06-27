import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface MinimalShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  onStartFresh?: () => void;
  startFreshDisabled?: boolean;
}

export function MinimalShell({
  children,
  title = 'Caspa',
  subtitle,
  onStartFresh,
  startFreshDisabled,
}: MinimalShellProps) {
  return (
    <div className="flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-[#0B0F19] text-slate-100">
      <header className="shrink-0 border-b border-slate-800/60 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-lg items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-medium tracking-tight text-white sm:text-lg">{title}</h1>
            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onStartFresh && (
              <button
                type="button"
                disabled={startFreshDisabled}
                onClick={onStartFresh}
                className="rounded-full border border-slate-800/60 px-3 py-1.5 text-xs text-slate-400 transition hover:border-slate-700 hover:text-slate-200 disabled:opacity-40"
              >
                New work
              </button>
            )}
            <Link
              to="/home"
              className="rounded-full border border-slate-800/60 bg-[#161B22]/80 px-3 py-1.5 text-xs text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
            >
              Studio
            </Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
