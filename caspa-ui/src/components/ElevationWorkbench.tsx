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
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {icon} {title}
        </h1>
        <p className="text-muted text-sm mt-1">{subtitle}</p>
      </div>

      <div className="card">
        <label className="label">Project</label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input max-w-md">
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      {requireProject && !projectId ? (
        <p className="text-muted text-center py-12">Select a project to get started</p>
      ) : (
        children({ projectId, setProjectId })
      )}
    </div>
  );
}

export function ResultCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card space-y-3">
      <h3 className="font-medium">{title}</h3>
      <div className="text-sm text-muted space-y-2">{children}</div>
    </div>
  );
}

export function JsonPreview({ data }: { data: unknown }) {
  return (
    <pre className="rounded-lg bg-white/5 p-4 text-xs overflow-auto max-h-96 whitespace-pre-wrap">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
