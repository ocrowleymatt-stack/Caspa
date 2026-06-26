import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Loader2, Plus, Search, Trash2, UploadCloud } from 'lucide-react';
import { createChapter } from '../api/chapters';
import { createProject, deleteProject, listProjects } from '../api/projects';
import { isSupportedManuscriptFile, readManuscriptFile } from '../lib/manuscriptUpload';
import { useAppStore } from '../store';
import { formatRelative } from '../lib/utils';
import { useToast } from '../components/Toast';

export default function Dashboard() {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [manuscriptText, setManuscriptText] = useState('');
  const [form, setForm] = useState({
    title: '',
    genre: 'Novel',
    description: '',
    targetWordCount: 80000,
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const fallbackTitle = uploadedName
        ? uploadedName.replace(/\.[^.]+$/, '')
        : 'Untitled Room';
      const cleanTitle = form.title.trim() || fallbackTitle;
      const cleanDescription = form.description.trim() || (uploadedName ? `Uploaded manuscript: ${fallbackTitle}` : 'A fresh blank room.');
      const targetWordCount = Number.isFinite(form.targetWordCount) && form.targetWordCount > 0 ? form.targetWordCount : 80000;

      const project = await createProject({
        ...form,
        title: cleanTitle,
        description: cleanDescription,
        targetWordCount,
      });

      if (manuscriptText.trim()) {
        await createChapter(project.id, {
          title: uploadedName ? `Uploaded manuscript: ${uploadedName}` : 'Imported manuscript',
          order: 1,
          content: manuscriptText,
          status: 'draft',
        });
      }
      return project;
    },
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['chapters', project.id] });
      setActiveProjectId(project.id);
      setShowModal(false);
      setForm({ title: '', genre: 'Novel', description: '', targetWordCount: 80000 });
      setUploadedName(null);
      setManuscriptText('');
      toast.success(`Created "${project.title}"`);
      navigate(`/projects/${project.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleManuscriptUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isSupportedManuscriptFile(file)) {
      toast.error('Quick upload supports .txt, .md, .rtf and .html. Convert PDF/DOCX to text or paste into Casper.');
      event.target.value = '';
      return;
    }

    const { title, text } = await readManuscriptFile(file);
    setUploadedName(file.name);
    setManuscriptText(text);
    setForm((current) => ({
      ...current,
      title: current.title.trim() ? current.title : title,
      genre: 'Manuscript Polish',
      description: current.description.trim()
        ? current.description
        : `Uploaded manuscript: ${title}`,
      targetWordCount: Math.max(current.targetWordCount, text.split(/\s+/).filter(Boolean).length),
    }));
    toast.success('Manuscript loaded — create the room to import it.');
    event.target.value = '';
  }

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
          <button type="button" onClick={() => setShowModal(true)} className="btn-primary self-start md:self-auto">
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
            <button type="button" onClick={() => setShowModal(true)} className="btn-primary mt-6">
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
                    <span className="badge shrink-0">{project.genre}</span>
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171a22]/55 p-4 backdrop-blur-sm">
          <form
            className="w-full max-w-lg rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-room"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            <h2 className="font-serif text-3xl font-semibold text-[#171a22]">New project</h2>
            <p className="mt-1 text-sm text-muted">Create the room first. Leave the title blank for an Untitled Room.</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="btn-secondary"
              >
                <UploadCloud className="h-4 w-4" /> Upload manuscript
              </button>
              {uploadedName && (
                <span className="rounded-full bg-[#fff1c9] px-3 py-1 text-xs font-semibold text-[#7c5b12]">
                  Loaded: {uploadedName}
                </span>
              )}
              <input
                ref={uploadInputRef}
                type="file"
                accept=".txt,.md,.markdown,.rtf,.html,.htm,text/*"
                className="hidden"
                onChange={handleManuscriptUpload}
              />
            </div>
            <div className="mt-6 space-y-4">
              <div>
                <label className="label">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input"
                  placeholder="Optional — what is this room about?"
                />
              </div>
              <div>
                <label className="label">Kind of work</label>
                <select
                  value={form.genre}
                  onChange={(e) => setForm({ ...form, genre: e.target.value })}
                  className="input"
                >
                  {['Novel', 'Script', 'Musical / Show', 'Manuscript Polish', 'Adaptation', 'Memoir', 'Thriller', 'Comedy', 'Historical', 'Experimental'].map(
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
                  className="input min-h-[110px] resize-y"
                  placeholder="The rough shape, the voice, the thing it might become..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="btn-primary"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create and open'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
