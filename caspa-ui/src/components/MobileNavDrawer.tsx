import { useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAppStore } from '../store';
import { useBodyScrollLock, useEscapeKey } from '../hooks/useOverlay';
import { Sidebar } from './Sidebar';
import { ScrollRegion } from './ScrollRegion';

export function MobileNavDrawer() {
  const open = useAppStore((s) => s.mobileNavOpen);
  const setOpen = useAppStore((s) => s.setMobileNavOpen);
  const navigate = useNavigate();

  const close = useCallback(() => setOpen(false), [setOpen]);
  useEscapeKey(open, close);
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] lg:hidden">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-[#171a22]/55 backdrop-blur-md"
        onClick={close}
      />
      <div className="relative flex h-full max-h-dvh w-[min(100%,20rem)] flex-col border-r border-[#eadfca] bg-[#fffaf0] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#eadfca] px-4 py-3">
          <div>
            <span className="font-serif text-lg font-semibold text-[#171a22]">Menu</span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#98711d]">Swipe or scroll for all tools</p>
          </div>
          <button type="button" onClick={close} className="btn-ghost min-h-[44px] min-w-[44px] p-2" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ScrollRegion hint="More tools below">
          <Sidebar mobileDrawer onNavigate={close} />
        </ScrollRegion>
        <div className="space-y-2 border-t border-[#eadfca] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <NavLink to="/start" onClick={close} className="btn-secondary w-full text-xs">
            Production Wizard
          </NavLink>
          <button
            type="button"
            className="btn-primary w-full text-xs"
            onClick={() => {
              close();
              navigate('/projects');
            }}
          >
            New / open project
          </button>
        </div>
      </div>
    </div>
  );
}
