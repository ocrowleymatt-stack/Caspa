import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { getProject } from '../../api/projects';
import { getProductionBrief } from '../../api/studio';
import { WorkbenchApplyRail } from './WorkbenchApplyRail';
import { WorkbenchSourceSelector } from './WorkbenchSourceSelector';
import { DEFAULT_WORKBENCH_SOURCE } from '../../lib/workbenchSource';
import { currentWorkLabel } from '../../lib/currentWork';
import { useAppStore } from '../../store';

const BASE_TABS = [
  { slug: '', label: 'Overview', group: 'primary' as const },
  { slug: 'sources', label: 'Sources', group: 'primary' as const },
  { slug: 'bible', label: 'Plan', group: 'primary' as const },
  { slug: 'manuscript', label: 'Write', group: 'primary' as const, dynamic: true as const },
  { slug: 'gold', label: 'Improve', group: 'primary' as const },
  { slug: 'outputs', label: 'Writing History', group: 'primary' as const },
  { slug: 'export', label: 'Export', group: 'primary' as const },
  { slug: 'book-map', label: 'Book Map', group: 'secondary' as const },
  { slug: 'structure', label: 'Structure', group: 'secondary' as const },
  { slug: 'pier', label: 'Pier Builder', group: 'secondary' as const },
  { slug: 'research', label: 'Research', group: 'secondary' as const },
  { slug: 'awards', label: 'Awards Shelf', group: 'secondary' as const },
  { slug: 'swarm', label: 'Agent Swarm', group: 'secondary' as const },
] as const;

const TABS = BASE_TABS;

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

  const { data: brief } = useQuery({
    queryKey: ['production-brief', id],
    queryFn: () => getProductionBrief(id!),
    enabled: !!id,
  });

  const workLabel = currentWorkLabel(project, brief);

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
    <div className="page-content mx-auto max-w-7xl space-y-6">
      <header className="page-panel shadow-room">
        <div className="border-b border-[#eadfca] px-4 py-4 sm:px-6 sm:py-5 md:px-8">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">
            Project workbench
          </div>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="break-words font-serif text-2xl font-semibold tracking-[-0.04em] text-[#171a22] sm:text-4xl md:text-5xl">
                {project.title}
              </h1>
              <p className="mt-2 max-w-full text-sm leading-6 text-muted">
                Sources → Plan → {workLabel} → Improve → Export. Advanced tools stay in the secondary tab row.
              </p>
            </div>
            <Link to={`/projects/${id}/bible`} className="btn-secondary w-full shrink-0 text-xs sm:w-auto">
              Open Plan
            </Link>
          </div>
        </div>
        <nav className="custom-scrollbar flex max-w-full gap-1 overflow-x-auto overscroll-x-contain px-2 py-3 sm:px-3 md:px-5">
          {TABS.filter((tab) => tab.group === 'primary').map((tab) => {
            const to = tab.slug ? `/projects/${id}/${tab.slug}` : `/projects/${id}`;
            const label = tab.slug === 'manuscript' && 'dynamic' in tab && tab.dynamic ? workLabel : tab.label;
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
                {label}
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
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
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
