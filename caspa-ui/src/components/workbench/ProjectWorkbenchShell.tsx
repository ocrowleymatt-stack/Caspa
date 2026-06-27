import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { getProject } from '../../api/projects';
import { WorkbenchApplyRail } from './WorkbenchApplyRail';
import { WorkbenchSourceSelector } from './WorkbenchSourceSelector';
import { DEFAULT_WORKBENCH_SOURCE } from '../../lib/workbenchSource';
import { useAppStore } from '../../store';

const TABS = [
  { slug: '', label: 'Overview', group: 'primary' as const },
  { slug: 'structure', label: 'Structure', group: 'primary' as const },
  { slug: 'manuscript', label: 'Manuscript', group: 'primary' as const },
  { slug: 'pier', label: 'Pier Builder', group: 'primary' as const },
  { slug: 'research', label: 'Research', group: 'primary' as const },
  { slug: 'gold', label: 'Improve', group: 'primary' as const },
  { slug: 'bible', label: 'Bible', group: 'primary' as const },
  { slug: 'book-map', label: 'Book Map', group: 'primary' as const },
  { slug: 'outputs', label: 'Saved Writing', group: 'primary' as const },
  { slug: 'awards', label: 'Awards Shelf', group: 'secondary' as const },
  { slug: 'swarm', label: 'Agent Swarm', group: 'secondary' as const },
  { slug: 'export', label: 'Export', group: 'secondary' as const },
] as const;

const SOURCE_TABS = new Set(['pier', 'research', 'swarm', 'awards', 'gold']);

export function ProjectWorkbenchShell() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const setWorkbenchSource = useAppStore((s) => s.setWorkbenchSource);

  useEffect(() => {
    if (id) {
      setActiveProjectId(id);
      setWorkbenchSource(DEFAULT_WORKBENCH_SOURCE);
    }
  }, [id, setActiveProjectId, setWorkbenchSource]);

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
        <nav className="flex flex-wrap gap-1 overflow-x-auto px-3 py-3 md:px-5">
          {TABS.filter((tab) => tab.group === 'primary').map((tab) => {
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
          <span className="mx-1 hidden h-8 w-px self-center bg-[#eadfca] md:inline-block" aria-hidden />
          {TABS.filter((tab) => tab.group === 'secondary').map((tab) => {
            const to = `/projects/${id}/${tab.slug}`;
            return (
              <NavLink
                key={tab.slug}
                to={to}
                className={({ isActive }) =>
                  `shrink-0 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] transition ${
                    isActive
                      ? 'bg-[#fff1c9] text-[#171a22] border border-[#caa044]'
                      : 'border border-[#eadfca] bg-white text-[#5f5648] hover:border-[#caa044]'
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
