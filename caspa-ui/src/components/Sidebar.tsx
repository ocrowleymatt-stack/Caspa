import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Command,
  FileText,
  Gem,
  Ghost,
  Hammer,
  LayoutDashboard,
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

const simpleNavItems = [
  { to: '/home', label: 'Command Centre', icon: LayoutDashboard },
  { to: '/command', label: 'Natural Command', icon: Command },
  { to: '/casper', label: 'Casper', icon: Ghost },
  { to: '/projects', label: 'Projects', icon: BookOpen },
  { to: '/forge', label: 'Forge', icon: Hammer },
  { to: '/music-prompt', label: 'Music', icon: Music2 },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/confidence', label: 'Publish Confidence', icon: ShieldCheck },
  { to: '/outputs', label: 'Outputs', icon: Package },
  { to: '/production', label: 'Jobs', icon: Clapperboard },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const expertNavItems = [
  { to: '/show-factory', label: 'Show Factory', icon: Theater },
  { to: '/music-lab', label: 'Music Lab', icon: Music },
  { to: '/show-in-a-box', label: 'Show In A Box', icon: Package },
  { to: '/publish', label: 'Publish', icon: Upload },
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

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
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

  const navItems = simpleMode ? simpleNavItems : [...simpleNavItems, ...expertNavItems];

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-white/10 bg-surface/80 backdrop-blur-sm transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
        {!collapsed && (
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              <span className="text-accent">CASPA</span> Studio
            </h1>
            <p className="text-xs text-muted">{simpleMode ? 'Simple Mode' : 'Expert Mode'}</p>
          </div>
        )}
        <button type="button" onClick={toggle} className="btn-ghost p-1.5">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="border-b border-white/10 p-3 space-y-2">
          <button
            type="button"
            onClick={toggleSimpleMode}
            className="flex w-full items-center justify-between rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs hover:bg-accent/10"
          >
            <span>{simpleMode ? 'Simple' : 'Expert'} Mode</span>
            <span className="text-accent">{simpleMode ? '→ Expert' : '→ Simple'}</span>
          </button>
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

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/home' || to === '/projects'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-accent/15 text-accent font-medium'
                  : 'text-muted hover:bg-white/5 hover:text-foreground',
                collapsed && 'justify-center px-2',
              )
            }
            title={label}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}

        {!simpleMode && !collapsed && (
          <div className="pt-4 mt-2">
            <p className="px-3 mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              ✨ Elevation
            </p>
            {elevationItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-white/5',
                  )
                }
              >
                <Icon className="h-4 w-4" /> {label}
              </NavLink>
            ))}
          </div>
        )}

        {!simpleMode && collapsed && elevationItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center justify-center rounded-lg px-2 py-2.5 text-sm transition-colors',
                isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-white/5',
              )
            }
            title={label}
          >
            <Icon className="h-4 w-4 shrink-0" />
          </NavLink>
        ))}

        {activeProjectId && !collapsed && (
          <div className="pt-4 mt-4 border-t border-white/10">
            <p className="px-3 mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Manuscript
            </p>
            <NavLink
              to={`/projects/${activeProjectId}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-white/5',
                )
              }
            >
              <PenLine className="h-4 w-4" /> Overview
            </NavLink>
            <NavLink
              to={`/projects/${activeProjectId}/characters`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-white/5',
                )
              }
            >
              <Users className="h-4 w-4" /> Characters
            </NavLink>
            <NavLink
              to={`/projects/${activeProjectId}/plot`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-white/5',
                )
              }
            >
              <Map className="h-4 w-4" /> Plot Board
            </NavLink>
            <NavLink
              to={`/projects/${activeProjectId}/research`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-white/5',
                )
              }
            >
              <BookMarked className="h-4 w-4" /> Research
            </NavLink>
          </div>
        )}
      </nav>

      {!collapsed && (
        <div className="border-t border-white/10 p-3 space-y-2">
          {user && (
            <div className="rounded-lg border border-white/10 px-3 py-2 space-y-2">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{user.displayName}</p>
                <p className="text-[10px] text-muted truncate">{user.email}</p>
              </div>
              {isAdmin() && (
                <NavLink
                  to="/admin/users"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors',
                      isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-white/5',
                    )
                  }
                >
                  <Shield className="h-3 w-3" /> User Management
                </NavLink>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-white/5 hover:text-foreground"
              >
                <LogOut className="h-3 w-3" /> Sign out
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => useAppStore.getState().setCommandPaletteOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-muted hover:bg-white/5"
          >
            <Sparkles className="h-3 w-3" />
            <span className="flex-1 text-left">Command palette</span>
            <kbd className="rounded border border-white/10 px-1">⌘K</kbd>
          </button>
        </div>
      )}
    </aside>
  );
}
