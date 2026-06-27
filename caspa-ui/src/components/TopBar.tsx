import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Search } from 'lucide-react';
import { getProject } from '../api/projects';
import { getChapter } from '../api/chapters';
import { useAppStore } from '../store';
import { AIPanelToggle } from './AIPanel';
import { ProviderStatus } from './ProviderStatus';

const pageTitles: Record<string, string> = {
  '/': 'Projects',
  '/home': 'The Studio',
  '/casper': 'Casper',
  '/command': 'Studio Command',
  '/show-factory': 'Show Factory',
  '/music-lab': 'Music Lab',
  '/production': 'Production',
  '/show-in-a-box': 'Show In A Box',
  '/publish': 'Publish',
  '/settings': 'Settings',
};

export function TopBar() {
  const location = useLocation();
  const { id: projectId, chapterId } = useParams();
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
  });

  const { data: chapter } = useQuery({
    queryKey: ['chapter', chapterId],
    queryFn: () => getChapter(chapterId!),
    enabled: !!chapterId,
  });

  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; to?: string }[] = [];
    const baseTitle = pageTitles[location.pathname] ?? '';

    if (projectId && project) {
      crumbs.push({ label: 'Projects', to: '/projects' });
      crumbs.push({ label: project.title, to: `/projects/${projectId}` });
      if (location.pathname.includes('/characters')) {
        crumbs.push({ label: 'Characters' });
      } else if (location.pathname.includes('/plot')) {
        crumbs.push({ label: 'Plot Board' });
      } else if (location.pathname.includes('/research')) {
        crumbs.push({ label: 'Research' });
      } else if (chapter) {
        crumbs.push({ label: chapter.title });
      } else if (!baseTitle) {
        crumbs.push({ label: 'Overview' });
      }
    } else if (baseTitle) {
      crumbs.push({ label: baseTitle });
    }

    return crumbs;
  }, [location.pathname, projectId, project, chapter]);

  return (
    <header className="flex h-16 items-center justify-between border-b border-[#eadfca] bg-[#fffaf0]/82 px-4 shadow-sm backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {breadcrumbs.map((crumb, i) => (
          <div key={i} className="flex min-w-0 items-center gap-2">
            {i > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-[#b89b56]" />}
            {crumb.to ? (
              <Link to={crumb.to} className="truncate text-sm font-medium text-muted hover:text-[#98711d]">
                {crumb.label}
              </Link>
            ) : (
              <span className="truncate font-serif text-lg font-semibold text-foreground">{crumb.label}</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <ProviderStatus compact className="hidden lg:inline-flex" />
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="btn-secondary hidden text-xs sm:flex"
        >
          <Search className="h-3.5 w-3.5" />
          Search
          <kbd className="ml-1 rounded border border-[#eadfca] bg-white px-1 text-[10px] text-muted">⌘K</kbd>
        </button>
        <AIPanelToggle />
      </div>
    </header>
  );
}
