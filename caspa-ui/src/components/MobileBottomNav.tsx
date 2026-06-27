import { NavLink } from 'react-router-dom';
import { BookOpen, Compass, Ghost, HelpCircle, Home, Package } from 'lucide-react';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';

const ITEMS = [
  { to: '/home', label: 'Today', icon: Home, end: true as const },
  { to: '/projects', label: 'Projects', icon: BookOpen, end: false as const },
  { to: '/casper', label: 'Write', icon: Ghost, end: false as const },
  { to: '/outputs', label: 'Saved', icon: Package, end: false as const },
  { to: '/help', label: 'Help', icon: HelpCircle, end: false as const },
] as const;

export function MobileBottomNav() {
  const setGuideOpen = useAppStore((s) => s.setGuideDrawerOpen);
  const activeProjectId = useAppStore((s) => s.activeProjectId);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#eadfca] bg-[#fffaf0]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(75,55,21,0.08)] backdrop-blur lg:hidden"
      aria-label="Primary navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex min-h-[44px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-semibold transition',
                isActive ? 'text-[#98711d]' : 'text-[#766b58]',
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span>{label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="flex min-h-[44px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-semibold text-[#766b58]"
          aria-label="Guide Me"
        >
          <Compass className="h-5 w-5 shrink-0" />
          <span>Guide</span>
        </button>
      </div>
      {activeProjectId && (
        <p className="truncate px-3 pb-1 text-center text-[10px] text-muted">
          Active project selected — open menu for Source Library &amp; Export
        </p>
      )}
    </nav>
  );
}
