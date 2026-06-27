import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { AIPanel } from './AIPanel';
import { CommandPalette } from './CommandPalette';
import { GuideMeDrawer } from './GuideMeDrawer';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';

export function Layout() {
  const aiPanelOpen = useAppStore((s) => s.aiPanelOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className={cn('flex flex-1 flex-col min-w-0 transition-all', aiPanelOpen && 'mr-96')}>
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1500px]">
            <Outlet />
          </div>
        </main>
      </div>
      <AIPanel />
      <CommandPalette />
      <GuideMeDrawer />
    </div>
  );
}
