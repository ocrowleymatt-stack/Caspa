import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  FileText,
  Music,
  Package,
  Search,
  Settings,
  Sparkles,
  Theater,
  Upload,
} from 'lucide-react';
import { listProjects } from '../api/projects';
import { listChapters } from '../api/chapters';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';

interface CommandItem {
  id: string;
  label: string;
  group: string;
  icon: React.ReactNode;
  action: () => void;
}

export function CommandPalette() {
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
    enabled: open,
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters', activeProjectId],
    queryFn: () => listChapters(activeProjectId!),
    enabled: open && !!activeProjectId,
  });

  const items = useMemo<CommandItem[]>(() => {
    const nav: CommandItem[] = [
      { id: 'nav-dash', label: 'Projects Dashboard', group: 'Navigate', icon: <BookOpen className="h-4 w-4" />, action: () => navigate('/') },
      { id: 'nav-show', label: 'Show Factory', group: 'Navigate', icon: <Theater className="h-4 w-4" />, action: () => navigate('/show-factory') },
      { id: 'nav-music', label: 'Music Lab', group: 'Navigate', icon: <Music className="h-4 w-4" />, action: () => navigate('/music-lab') },
      { id: 'nav-prod', label: 'Production Jobs', group: 'Navigate', icon: <Sparkles className="h-4 w-4" />, action: () => navigate('/production') },
      { id: 'nav-box', label: 'Show In A Box', group: 'Navigate', icon: <Package className="h-4 w-4" />, action: () => navigate('/show-in-a-box') },
      { id: 'nav-pub', label: 'Publish', group: 'Navigate', icon: <Upload className="h-4 w-4" />, action: () => navigate('/publish') },
      { id: 'nav-set', label: 'Settings', group: 'Navigate', icon: <Settings className="h-4 w-4" />, action: () => navigate('/settings') },
    ];

    const projectItems: CommandItem[] = projects.map((p) => ({
      id: `proj-${p.id}`,
      label: p.title,
      group: 'Projects',
      icon: <BookOpen className="h-4 w-4" />,
      action: () => navigate(`/projects/${p.id}`),
    }));

    const chapterItems: CommandItem[] = chapters.map((c) => ({
      id: `ch-${c.id}`,
      label: c.title,
      group: 'Chapters',
      icon: <FileText className="h-4 w-4" />,
      action: () => navigate(`/projects/${c.projectId}/chapters/${c.id}`),
    }));

    return [...nav, ...projectItems, ...chapterItems];
  }, [projects, chapters, navigate]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    setSelected(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelected(0);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
      if (!open) return;
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, filtered.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      }
      if (e.key === 'Enter' && filtered[selected]) {
        e.preventDefault();
        filtered[selected].action();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, setOpen, filtered, selected]);

  if (!open) return null;

  const groups = [...new Set(filtered.map((i) => i.group))];

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-surface shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-white/10 px-4">
          <Search className="h-4 w-4 text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, chapters, pages..."
            className="flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted"
          />
          <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-xs text-muted">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No results found</p>
          ) : (
            groups.map((group) => (
              <div key={group} className="mb-2">
                <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted">{group}</p>
                {filtered
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const idx = filtered.indexOf(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          item.action();
                          setOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-left transition-colors',
                          idx === selected ? 'bg-accent/20 text-accent' : 'hover:bg-white/5',
                        )}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    );
                  })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
