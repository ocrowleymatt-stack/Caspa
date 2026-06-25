import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Search } from 'lucide-react';
import { getProject } from '../api/projects';
import { getChapter } from '../api/chapters';
import { useAppStore } from '../store';
import { AIPanelToggle } from './AIPanel';

const pageTitles: Record<string, string> = {
  '/': 'Projects',
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
      crumbs.push({ label: 'Projects', to: '/' });
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
    <header className="flex h-14 items-center justify-between border-b border-white/10 bg-background/50 backdrop-blur-sm px-6">
      <div className="flex items-center gap-2 min-w-0">
        {breadcrumbs.map((crumb, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            {i > 0 && <ChevronRight className="h-4 w-4 text-muted shrink-0" />}
            {crumb.to ? (
              <Link to={crumb.to} className="text-sm text-muted hover:text-accent truncate">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-sm font-medium truncate">{crumb.label}</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="btn-secondary text-xs hidden sm:flex"
        >
          <Search className="h-3.5 w-3.5" />
          Search
          <kbd className="ml-1 rounded border border-white/10 px-1 text-[10px]">⌘K</kbd>
        </button>
        <AIPanelToggle />
      </div>
    </header>
  );
}
