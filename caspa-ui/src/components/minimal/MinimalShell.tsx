import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface MinimalShellProps {
  children: ReactNode;
  title?: string;
}

export function MinimalShell({ children, title = 'Caspa' }: MinimalShellProps) {
  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <div>
          <h1 className="text-lg font-medium tracking-tight text-white">{title}</h1>
          <p className="mt-0.5 text-xs text-slate-500">Write. Nothing else.</p>
        </div>
        <Link
          to="/home"
          className="rounded-full border border-slate-800/60 bg-[#161B22]/80 px-3 py-1.5 text-xs text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
        >
          Studio mode
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-col px-6 pb-16 pt-4 md:px-10">
        {children}
      </main>
    </div>
  );
}
