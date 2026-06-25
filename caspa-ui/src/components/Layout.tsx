import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { AIPanel } from './AIPanel';
import { CommandPalette } from './CommandPalette';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';

export function Layout() {
  const aiPanelOpen = useAppStore((s) => s.aiPanelOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className={cn('flex flex-1 flex-col min-w-0 transition-all', aiPanelOpen && 'mr-96')}>
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <AIPanel />
      <CommandPalette />
    </div>
  );
}
