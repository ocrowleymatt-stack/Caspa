import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { AIPanel } from './AIPanel';
import { CommandPalette } from './CommandPalette';
import { GuideMeDrawer } from './GuideMeDrawer';
import { MobileNavDrawer } from './MobileNavDrawer';
import { MobileBottomNav } from './MobileBottomNav';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';

export function Layout() {
  const aiPanelOpen = useAppStore((s) => s.aiPanelOpen);

  return (
    <div className="app-shell flex min-h-dvh h-dvh max-h-dvh w-full overflow-hidden bg-background text-foreground">
      <div className="hidden h-full shrink-0 lg:flex">
        <Sidebar />
      </div>
      <MobileNavDrawer />
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col transition-all',
          aiPanelOpen && 'lg:mr-[27rem]',
        )}
      >
        <TopBar />
        <main className="page-scroll custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-6 lg:pb-6">
          <div className="page-content mx-auto w-full max-w-[1500px]">
            <Outlet />
          </div>
        </main>
      </div>
      <AIPanel />
      <CommandPalette />
      <GuideMeDrawer />
      <MobileBottomNav />
    </div>
  );
}
