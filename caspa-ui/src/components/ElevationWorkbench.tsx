import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listProjects } from '../api/projects';
import { useAppStore } from '../store';

interface Props {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: (ctx: { projectId: string; setProjectId: (id: string) => void }) => ReactNode;
  requireProject?: boolean;
}

export function ElevationWorkbench({ title, subtitle, icon, children, requireProject = true }: Props) {
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const [projectId, setProjectId] = useState(activeProjectId ?? '');

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: listProjects });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-[2.2rem] border border-[#eadfca] bg-white p-7 shadow-room md:p-9">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#dfc991] bg-[#fffaf0] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#98711d]">
              {icon} Tool room
            </div>
            <h1 className="font-serif text-5xl font-semibold leading-none tracking-[-0.045em] text-[#171a22] md:text-6xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{subtitle}</p>
          </div>
          <div className="w-full md:w-80">
            <label className="label">Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input">
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {requireProject && !projectId ? (
        <div className="rounded-[2rem] border border-[#eadfca] bg-white/85 py-14 text-center shadow-paper">
          <p className="text-muted">Select a project to get started.</p>
        </div>
      ) : (
        children({ projectId, setProjectId })
      )}
    </div>
  );
}

export function ResultCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[1.8rem] border border-[#eadfca] bg-white/85 p-5 shadow-paper space-y-3">
      <h3 className="font-serif text-2xl font-semibold text-[#171a22]">{title}</h3>
      <div className="space-y-2 text-sm leading-6 text-muted">{children}</div>
    </div>
  );
}

export function JsonPreview({ data }: { data: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-4 text-xs leading-5 text-[#3d352b]">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
