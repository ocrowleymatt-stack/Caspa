import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { getProject } from '../../api/projects';
import { WorkbenchApplyRail } from './WorkbenchApplyRail';
import { WorkbenchSourceSelector } from './WorkbenchSourceSelector';
import { useAppStore } from '../../store';

const TABS = [
  { slug: '', label: 'Overview' },
  { slug: 'structure', label: 'Structure' },
  { slug: 'manuscript', label: 'Manuscript' },
  { slug: 'pier', label: 'Pier Builder' },
  { slug: 'research', label: 'Research' },
  { slug: 'swarm', label: 'Agent Swarm' },
  { slug: 'awards', label: 'Awards Shelf' },
  { slug: 'gold', label: 'Gold Pass' },
  { slug: 'outputs', label: 'Outputs' },
  { slug: 'export', label: 'Export' },
] as const;

const SOURCE_TABS = new Set(['pier', 'research', 'swarm', 'awards', 'gold']);

export function ProjectWorkbenchShell() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);

  useEffect(() => {
    if (id) setActiveProjectId(id);
  }, [id, setActiveProjectId]);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  });

  const activeSlug = location.pathname.replace(`/projects/${id}`, '').replace(/^\//, '') || '';
  const showSource = SOURCE_TABS.has(activeSlug);
  const showApply = ['swarm', 'awards', 'gold', 'outputs'].includes(activeSlug);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#98711d]" />
      </div>
    );
  }

  if (!project || !id) {
    return <p className="py-20 text-center text-muted">Project not found</p>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="overflow-hidden rounded-[2rem] border border-[#eadfca] bg-white shadow-room">
        <div className="border-b border-[#eadfca] px-6 py-5 md:px-8">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">
            Project workbench
          </div>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-serif text-4xl font-semibold tracking-[-0.04em] text-[#171a22] md:text-5xl">
                {project.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                One room for structure, research, swarm critique, awards lenses, gold synthesis, and exports.
              </p>
            </div>
            <Link to={`/projects/${id}/bible`} className="btn-secondary text-xs">
              Project Bible
            </Link>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-3 md:px-5">
          {TABS.map((tab) => {
            const to = tab.slug ? `/projects/${id}/${tab.slug}` : `/projects/${id}`;
            return (
              <NavLink
                key={tab.slug || 'overview'}
                to={to}
                end={!tab.slug}
                className={({ isActive }) =>
                  `shrink-0 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] transition ${
                    isActive
                      ? 'bg-[#171a22] text-[#fffdf8]'
                      : 'border border-[#eadfca] bg-[#fffdf8] text-[#5f5648] hover:border-[#caa044]'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            );
          })}
        </nav>
      </header>

      <div className={`grid gap-6 ${showSource ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
        <div className="min-w-0">
          <Outlet context={{ projectId: id, project }} />
        </div>
        {(showSource || showApply) && (
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {showSource && <WorkbenchSourceSelector projectId={id} />}
            {showApply && <WorkbenchApplyRail projectId={id} hasText />}
          </aside>
        )}
      </div>
    </div>
  );
}

export interface ProjectWorkbenchContext {
  projectId: string;
  project: NonNullable<Awaited<ReturnType<typeof getProject>>>;
}
