import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { createProject, deleteProject, listProjects } from '../api/projects';
import { useAppStore } from '../store';
import { formatRelative } from '../lib/utils';
import { useToast } from '../components/Toast';

export default function Dashboard() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: '',
    genre: 'Literary Fiction',
    description: '',
    targetWordCount: 80000,
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  });

  const createMutation = useMutation({
    mutationFn: () => createProject(form),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setActiveProjectId(project.id);
      setShowModal(false);
      setForm({ title: '', genre: 'Literary Fiction', description: '', targetWordCount: 80000 });
      toast.success(`Created "${project.title}"`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
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
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted text-sm mt-1">Your manuscripts and creative works</p>
        </div>
        <button type="button" onClick={() => setShowModal(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> New Project
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="input pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <BookOpen className="h-12 w-12 text-muted mb-4 opacity-40" />
          <h2 className="text-lg font-medium mb-2">
            {search ? 'No matching projects' : 'No projects yet'}
          </h2>
          <p className="text-muted text-sm mb-6 max-w-sm">
            {search
              ? 'Try a different search term'
              : 'Create your first manuscript to get started with CASPA Studio'}
          </p>
          {!search && (
            <button type="button" onClick={() => setShowModal(true)} className="btn-primary">
              <Plus className="h-4 w-4" /> Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => {
            const progress = Math.min(
              100,
              Math.round((project.currentWordCount / (project.targetWordCount || 1)) * 100),
            );
            return (
              <div key={project.id} className="card group relative hover:border-accent/30 transition-colors">
                <Link
                  to={`/projects/${project.id}`}
                  onClick={() => setActiveProjectId(project.id)}
                  className="block"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold truncate">{project.title}</h3>
                    <span className="badge bg-accent/10 text-accent shrink-0">{project.genre}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted line-clamp-2 min-h-[2.5rem]">
                    {project.description || 'No description'}
                  </p>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs text-muted">
                      <span>{project.currentWordCount.toLocaleString()} words</span>
                      <span>{progress}% of goal</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
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
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 btn-ghost p-1.5 text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">New Project</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input"
                  placeholder="My Novel"
                />
              </div>
              <div>
                <label className="label">Genre</label>
                <select
                  value={form.genre}
                  onChange={(e) => setForm({ ...form, genre: e.target.value })}
                  className="input"
                >
                  {['Literary Fiction', 'Thriller', 'Romance', 'Sci-Fi', 'Fantasy', 'Memoir', 'Historical'].map(
                    (g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div>
                <label className="label">Target Word Count</label>
                <input
                  type="number"
                  value={form.targetWordCount}
                  onChange={(e) => setForm({ ...form, targetWordCount: Number(e.target.value) })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input min-h-[80px] resize-y"
                  placeholder="Brief synopsis..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                disabled={!form.title.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="btn-primary"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
