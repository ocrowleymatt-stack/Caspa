import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Menu, Search } from 'lucide-react';
import { getProject } from '../api/projects';
import { getChapter } from '../api/chapters';
import { useAppStore } from '../store';
import { AIPanelToggle } from './AIPanel';
import { ProviderStatus } from './ProviderStatus';
import { GuideMeButton } from './GuideMeDrawer';

const pageTitles: Record<string, string> = {
  '/': 'Projects',
  '/home': 'The Studio',
  '/start': 'Production Wizard',
  '/wizard': 'Production Wizard',
  '/help': 'Help Centre',
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
  const setMobileNavOpen = useAppStore((s) => s.setMobileNavOpen);

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
    <header className="sticky top-0 z-40 flex h-14 min-h-[3.5rem] shrink-0 items-center justify-between gap-2 border-b border-[#eadfca] bg-[#fffaf0]/92 px-3 shadow-sm backdrop-blur md:h-16 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          className="btn-ghost min-h-[44px] min-w-[44px] p-2 lg:hidden"
          aria-label="Open menu"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-1 overflow-hidden md:gap-2">
        {breadcrumbs.slice(-2).map((crumb, i) => (
          <div key={i} className="flex min-w-0 items-center gap-1 md:gap-2">
            {i > 0 && <ChevronRight className="hidden h-4 w-4 shrink-0 text-[#b89b56] sm:block" />}
            {crumb.to ? (
              <Link to={crumb.to} className="truncate text-xs font-medium text-muted hover:text-[#98711d] md:text-sm">
                {crumb.label}
              </Link>
            ) : (
              <span className="truncate font-serif text-base font-semibold text-foreground md:text-lg">{crumb.label}</span>
            )}
          </div>
        ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        <GuideMeButton className="hidden min-h-[44px] sm:inline-flex" />
        <ProviderStatus compact className="hidden xl:inline-flex" />
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="btn-secondary hidden min-h-[44px] text-xs sm:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Search</span>
          <kbd className="ml-1 hidden rounded border border-[#eadfca] bg-white px-1 text-[10px] text-muted lg:inline">⌘K</kbd>
        </button>
        <AIPanelToggle />
      </div>
    </header>
  );
}
