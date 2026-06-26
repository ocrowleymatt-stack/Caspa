import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { deleteProject, listProjects } from '../api/projects';
import { NewProjectWizard } from '../components/NewProjectWizard';
import { WORK_TYPE_LABELS } from '../lib/workModel';
import { useAppStore } from '../store';
import { formatRelative } from '../lib/utils';
import { useToast } from '../components/Toast';

export default function Dashboard() {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const [search, setSearch] = useState('');
  const [showWizard, setShowWizard] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: (_result, deletedId) => {
      const activeId = useAppStore.getState().activeProjectId;
      if (activeId === deletedId) {
        setActiveProjectId(null);
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.genre.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }, [projects, search]);

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <section className="rounded-[2.4rem] border border-[#eadfca] bg-white p-7 shadow-room md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dfc991] bg-[#fffaf0] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[#98711d] shadow-sm">
              <BookOpen className="h-4 w-4" /> Library
            </div>
            <h1 className="mt-5 font-serif text-5xl font-semibold leading-none tracking-[-0.045em] text-[#171a22] md:text-7xl">
              Your rooms of work.
            </h1>
            <p className="mt-4 text-lg leading-8 text-muted">
              Novels, scripts, shows, source material and half-glorious chaos. Open a room and keep writing.
            </p>
          </div>
          <button type="button" onClick={() => setShowWizard(true)} className="btn-primary self-start md:self-auto">
            <Plus className="h-4 w-4" /> New Project
          </button>
        </div>

        <div className="relative mt-7">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98711d]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects, genres, notes..."
            className="input pl-11 text-base"
          />
        </div>
      </section>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#98711d]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[2.2rem] border border-[#eadfca] bg-white/85 px-8 py-16 text-center shadow-paper">
          <BookOpen className="mx-auto mb-5 h-14 w-14 text-[#98711d] opacity-60" />
          <h2 className="font-serif text-3xl font-semibold text-[#171a22]">
            {search ? 'No matching rooms' : 'No projects yet'}
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted">
            {search
              ? 'Try another word, title, genre or bit of chaos.'
              : 'Create the first room. Casper can help with the mess once the door exists.'}
          </p>
          {!search && (
            <button type="button" onClick={() => setShowWizard(true)} className="btn-primary mt-6">
              <Plus className="h-4 w-4" /> Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => {
            const progress = Math.min(
              100,
              Math.round((project.currentWordCount / (project.targetWordCount || 1)) * 100),
            );
            return (
              <div
                key={project.id}
                className="group relative overflow-hidden rounded-[2rem] border border-[#eadfca] bg-white p-5 shadow-paper transition-all hover:-translate-y-1 hover:border-accent hover:shadow-room"
              >
                <Link
                  to={`/projects/${project.id}`}
                  onClick={() => setActiveProjectId(project.id)}
                  className="block"
                >
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff1c9] text-[#98711d]">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <span className="badge shrink-0">
                      {project.workType ? WORK_TYPE_LABELS[project.workType] : project.genre}
                    </span>
                  </div>
                  <h3 className="truncate font-serif text-2xl font-semibold text-[#171a22]">{project.title}</h3>
                  <p className="mt-2 line-clamp-3 min-h-[4.25rem] text-sm leading-6 text-muted">
                    {project.description || 'No description yet. Open the room and let it start talking.'}
                  </p>
                  <div className="mt-5 space-y-3">
                    <div className="flex justify-between text-xs font-semibold text-muted">
                      <span>{project.currentWordCount.toLocaleString()} words</span>
                      <span>{progress}% of goal</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#f1e6d2]">
                      <div
                        className="h-full rounded-full bg-[#171a22] transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted">Edited {formatRelative(project.updatedAt)}</p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete "${project.title}"?`)) {
                      deleteMutation.mutate(project.id);
                    }
                  }}
                  className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-red-500 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-red-50"
                  title="Delete project"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <NewProjectWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onCreated={(projectId, route) => {
          setActiveProjectId(projectId);
          setShowWizard(false);
          navigate(route);
        }}
      />
    </div>
  );
}
