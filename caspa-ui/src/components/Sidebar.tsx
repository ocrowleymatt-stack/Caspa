import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Anchor,
  BookOpen,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Command,
  FileText,
  Gem,
  Ghost,
  Home,
  LogOut,
  Map,
  MapPin,
  BookMarked,
  Mic,
  Music,
  Music2,
  Package,
  Paintbrush,
  PenLine,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Theater,
  Trophy,
  Upload,
  Users,
  Palette,
} from 'lucide-react';
import { logout } from '../api/auth';
import { listProjects } from '../api/projects';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';

const primaryNavItems = [
  { to: '/home', label: 'Today', icon: Home },
  { to: '/projects', label: 'Projects', icon: BookOpen },
  { to: '/casper', label: 'Write', icon: Ghost },
  { to: '/outputs', label: 'Writing History', icon: Package },
];

const authorToolsNavItems = [
  { to: '/command', label: 'Studio Command', icon: Command },
  { to: '/help', label: 'Help Centre', icon: FileText },
  { to: '/start', label: 'Production Wizard', icon: Sparkles },
];

const moreToolsNavItems = [
  { to: '/music-prompt', label: 'Music', icon: Music2 },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/confidence', label: 'Confidence', icon: ShieldCheck },
  { to: '/production', label: 'Production', icon: Clapperboard },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const expertNavItems = [
  { to: '/show-factory', label: 'Show Factory', icon: Theater },
  { to: '/music-lab', label: 'Music Lab', icon: Music },
  { to: '/show-in-a-box', label: 'Show In A Box', icon: Package },
  { to: '/publish', label: 'Publish', icon: Upload },
  { to: '/forge', label: 'Forge (legacy)', icon: Sparkles },
];

const elevationItems = [
  { to: '/wonder', label: 'Wonder', icon: Sparkles },
  { to: '/quality', label: 'Quality', icon: ShieldCheck },
  { to: '/taste', label: 'Taste', icon: Palette },
  { to: '/audience', label: 'Audience', icon: Users },
  { to: '/showstopper', label: 'Showstopper', icon: Star },
  { to: '/rehearsal', label: 'Rehearsal', icon: Mic },
  { to: '/producer', label: 'Producer', icon: Briefcase },
  { to: '/localise', label: 'Localise', icon: MapPin },
  { to: '/visuals', label: 'Visuals', icon: Paintbrush },
  { to: '/awards', label: 'Awards', icon: Trophy },
  { to: '/gold', label: 'Gold', icon: Gem },
];

const projectPrimaryLinks = (projectId: string) => [
  { to: `/projects/${projectId}`, label: 'Overview', icon: PenLine, end: true },
  { to: `/projects/${projectId}/sources`, label: 'Sources', icon: FileText },
  { to: `/projects/${projectId}/bible`, label: 'Plan', icon: BookOpen },
  { to: `/projects/${projectId}/manuscript`, label: 'Write', icon: BookOpen },
  { to: `/projects/${projectId}/gold`, label: 'Improve', icon: Gem },
  { to: `/projects/${projectId}/outputs`, label: 'Writing History', icon: Package },
  { to: `/projects/${projectId}/export`, label: 'Export', icon: Upload },
];

const projectSecondaryLinks = (projectId: string) => [
  { to: `/projects/${projectId}/book-map`, label: 'Book Map', icon: Map },
  { to: `/projects/${projectId}/structure`, label: 'Structure', icon: Map },
  { to: `/projects/${projectId}/research`, label: 'Research', icon: BookMarked },
  { to: `/projects/${projectId}/pier`, label: 'Pier', icon: Anchor },
  { to: `/projects/${projectId}/swarm`, label: 'Swarm', icon: Users },
  { to: `/projects/${projectId}/awards`, label: 'Awards', icon: Trophy },
];

function NavSection({
  title,
  collapsed,
  children,
}: {
  title?: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  if (collapsed) return <>{children}</>;
  return (
    <div className="mt-3 border-t border-[#eadfca] pt-3">
      {title && (
        <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#98711d]">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

export function Sidebar({
  mobileDrawer = false,
  onNavigate,
}: {
  mobileDrawer?: boolean;
  onNavigate?: () => void;
} = {}) {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const collapsed = mobileDrawer ? false : sidebarCollapsed;
  const simpleMode = useAppStore((s) => s.simpleMode);
  const toggleSimpleMode = useAppStore((s) => s.toggleSimpleMode);
  const toggle = useAppStore((s) => s.toggleSidebar);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const user = useAppStore((s) => s.user);
  const clearAuth = useAppStore((s) => s.clearAuth);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Clear local session even if server logout fails
    }
    clearAuth();
    navigate('/login', { replace: true });
  }

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  });

  const renderLink = (
    to: string,
    label: string,
    Icon: typeof Home,
    end = false,
  ) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all',
          isActive
            ? 'bg-[#171a22] text-white shadow-lg shadow-[#171a22]/10'
            : 'text-[#6d6354] hover:bg-[#fff8e8] hover:text-[#171a22]',
          collapsed && 'justify-center px-2',
        )
      }
      title={label}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && label}
    </NavLink>
  );

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-[#eadfca] bg-[#fffaf0]/90 shadow-[12px_0_45px_rgba(75,55,21,0.08)] backdrop-blur transition-all duration-200',
        mobileDrawer ? 'h-auto w-full border-r-0 shadow-none' : 'h-full',
        !mobileDrawer && (collapsed ? 'w-16' : 'w-64'),
      )}
    >
      {!mobileDrawer && (
        <div className="flex items-center justify-between border-b border-[#eadfca] px-4 py-5">
          {!collapsed && (
            <div>
              <h1 className="font-serif text-xl font-semibold tracking-tight text-[#171a22]">
                <span className="text-[#98711d]">CASPA</span> Studio
              </h1>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b8661]">
                {simpleMode ? 'Writer mode' : 'Producer mode'}
              </p>
            </div>
          )}
          <button type="button" onClick={toggle} className="btn-ghost min-h-[44px] min-w-[44px] p-1.5" aria-label="Toggle sidebar">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      )}

      {!collapsed && (
        <div className={cn('space-y-3 border-b border-[#eadfca] p-3', mobileDrawer && 'pt-1')}>
          {!mobileDrawer && (
            <button
              type="button"
              onClick={toggleSimpleMode}
              className="flex w-full items-center justify-between rounded-2xl border border-[#e7d8b9] bg-white/75 px-3 py-2.5 text-xs font-semibold text-[#5e5445] shadow-sm transition hover:border-accent hover:bg-[#fff8e8]"
            >
              <span>{simpleMode ? 'Writer' : 'Producer'} Mode</span>
              <span className="text-[#98711d]">{simpleMode ? '→ Producer' : '→ Writer'}</span>
            </button>
          )}
          <div>
            <label className="label">Active Project</label>
            <select
              value={activeProjectId ?? ''}
              onChange={(e) => {
                const id = e.target.value || null;
                setActiveProjectId(id);
                if (id) navigate(`/projects/${id}`);
              }}
              className="input text-xs"
            >
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <nav
        className={cn(
          'space-y-1 p-2',
          mobileDrawer ? 'pb-4' : 'custom-scrollbar menu-scroll min-h-0 flex-1 overflow-y-auto',
        )}
      >
        {!collapsed && (
          <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#98711d]">
            Primary
          </p>
        )}
        {primaryNavItems.map(({ to, label, icon: Icon }) => renderLink(to, label, Icon, to === '/home' || to === '/projects'))}

        <NavSection title={collapsed ? undefined : 'More Tools'} collapsed={collapsed}>
          {authorToolsNavItems.map(({ to, label, icon: Icon }) => renderLink(to, label, Icon))}
          {moreToolsNavItems.map(({ to, label, icon: Icon }) => renderLink(to, label, Icon))}
        </NavSection>

        {activeProjectId && (
          <NavSection title={collapsed ? undefined : 'This project'} collapsed={collapsed}>
            {projectPrimaryLinks(activeProjectId).map(({ to, label, icon: Icon, end }) =>
              renderLink(to, label, Icon, end),
            )}
            {!collapsed && (
              <p className="mb-1 mt-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b89b56]">
                Also
              </p>
            )}
            {projectSecondaryLinks(activeProjectId).map(({ to, label, icon: Icon }) =>
              renderLink(to, label, Icon),
            )}
          </NavSection>
        )}

        {!simpleMode && (
          <NavSection title={collapsed ? undefined : 'More Tools (advanced)'} collapsed={collapsed}>
            {elevationItems.map(({ to, label, icon: Icon }) => renderLink(to, label, Icon))}
            {expertNavItems.map(({ to, label, icon: Icon }) => renderLink(to, label, Icon))}
          </NavSection>
        )}
      </nav>

      {!collapsed && (
        <div className={cn('space-y-2 border-t border-[#eadfca] p-3', mobileDrawer && 'pb-6')}>
          {user && (
            <div className="space-y-2 rounded-2xl border border-[#eadfca] bg-white/70 px-3 py-2 shadow-sm">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[#171a22]">{user.displayName}</p>
                <p className="truncate text-[10px] text-muted">{user.email}</p>
              </div>
              {isAdmin() && (
                <NavLink
                  to="/admin/users"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs transition-colors',
                      isActive ? 'bg-[#171a22] text-white' : 'text-muted hover:bg-[#fff8e8]',
                    )
                  }
                >
                  <Shield className="h-3 w-3" /> User Management
                </NavLink>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-xs text-muted hover:bg-[#fff8e8] hover:text-foreground"
              >
                <LogOut className="h-3 w-3" /> Sign out
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => useAppStore.getState().setCommandPaletteOpen(true)}
            className="flex w-full items-center gap-2 rounded-2xl border border-[#eadfca] bg-white/70 px-3 py-2 text-xs font-semibold text-muted shadow-sm hover:bg-[#fff8e8]"
          >
            <Sparkles className="h-3 w-3 text-[#98711d]" />
            <span className="flex-1 text-left">Command palette</span>
            <kbd className="rounded border border-[#eadfca] bg-white px-1">⌘K</kbd>
          </button>
        </div>
      )}
    </aside>
  );
}
