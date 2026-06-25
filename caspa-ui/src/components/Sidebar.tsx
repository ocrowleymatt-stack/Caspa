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

const simpleNavItems = [
  { to: '/home', label: 'Studio', icon: Home },
  { to: '/casper', label: 'Casper', icon: Ghost },
  { to: '/projects', label: 'Projects', icon: BookOpen },
  { to: '/command', label: 'Ask', icon: Command },
  { to: '/forge', label: 'Forge', icon: Hammer },
  { to: '/music-prompt', label: 'Music', icon: Music2 },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/confidence', label: 'Confidence', icon: ShieldCheck },
  { to: '/outputs', label: 'Outputs', icon: Package },
  { to: '/production', label: 'Production', icon: Clapperboard },
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
        'flex h-full flex-col border-r border-[#eadfca] bg-[#fffaf0]/90 shadow-[12px_0_45px_rgba(75,55,21,0.08)] backdrop-blur transition-all duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
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
        <button type="button" onClick={toggle} className="btn-ghost p-1.5">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-3 border-b border-[#eadfca] p-3">
          <button
            type="button"
            onClick={toggleSimpleMode}
            className="flex w-full items-center justify-between rounded-2xl border border-[#e7d8b9] bg-white/75 px-3 py-2.5 text-xs font-semibold text-[#5e5445] shadow-sm transition hover:border-accent hover:bg-[#fff8e8]"
          >
            <span>{simpleMode ? 'Writer' : 'Producer'} Mode</span>
            <span className="text-[#98711d]">{simpleMode ? '→ Producer' : '→ Writer'}</span>
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

      <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/home' || to === '/projects'}
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
        ))}

        {!simpleMode && !collapsed && (
          <div className="mt-3 border-t border-[#eadfca] pt-4">
            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#98711d]">
              Elevation
            </p>
            {elevationItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-all',
                    isActive ? 'bg-[#fff1c9] text-[#171a22]' : 'text-[#6d6354] hover:bg-[#fff8e8] hover:text-[#171a22]',
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
                'flex items-center justify-center rounded-2xl px-2 py-2.5 text-sm transition-all',
                isActive ? 'bg-[#171a22] text-white' : 'text-[#6d6354] hover:bg-[#fff8e8]',
              )
            }
            title={label}
          >
            <Icon className="h-4 w-4 shrink-0" />
          </NavLink>
        ))}

        {activeProjectId && !collapsed && (
          <div className="mt-4 border-t border-[#eadfca] pt-4">
            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#98711d]">
              Manuscript
            </p>
            <NavLink
              to={`/projects/${activeProjectId}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-all',
                  isActive ? 'bg-[#fff1c9] text-[#171a22]' : 'text-[#6d6354] hover:bg-[#fff8e8] hover:text-[#171a22]',
                )
              }
            >
              <PenLine className="h-4 w-4" /> Overview
            </NavLink>
            <NavLink
              to={`/projects/${activeProjectId}/characters`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-all',
                  isActive ? 'bg-[#fff1c9] text-[#171a22]' : 'text-[#6d6354] hover:bg-[#fff8e8] hover:text-[#171a22]',
                )
              }
            >
              <Users className="h-4 w-4" /> Characters
            </NavLink>
            <NavLink
              to={`/projects/${activeProjectId}/plot`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-all',
                  isActive ? 'bg-[#fff1c9] text-[#171a22]' : 'text-[#6d6354] hover:bg-[#fff8e8] hover:text-[#171a22]',
                )
              }
            >
              <Map className="h-4 w-4" /> Plot Board
            </NavLink>
            <NavLink
              to={`/projects/${activeProjectId}/research`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-all',
                  isActive ? 'bg-[#fff1c9] text-[#171a22]' : 'text-[#6d6354] hover:bg-[#fff8e8] hover:text-[#171a22]',
                )
              }
            >
              <BookMarked className="h-4 w-4" /> Research
            </NavLink>
          </div>
        )}
      </nav>

      {!collapsed && (
        <div className="space-y-2 border-t border-[#eadfca] p-3">
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
