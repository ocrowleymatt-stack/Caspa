import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import {
  createResearchNote,
  deleteResearchNote,
  listResearchNotes,
  searchResearchNotes,
  updateResearchNote,
} from '../api/research';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';
import { useToast } from '../components/Toast';
import type { ResearchNote } from '../types';

const emptyForm = {
  title: '',
  content: '',
  tags: '',
};

export default function Research() {
  const { id: projectId } = useParams<{ id: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ResearchNote | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['research', projectId, activeTag, searchQuery],
    queryFn: async () => {
      if (searchQuery.trim()) {
        return searchResearchNotes(projectId!, searchQuery.trim());
      }
      return listResearchNotes(projectId!, activeTag ? [activeTag] : undefined);
    },
    enabled: !!projectId,
  });

  const { data: allNotes = [] } = useQuery({
    queryKey: ['research-all', projectId],
    queryFn: () => listResearchNotes(projectId!),
    enabled: !!projectId,
  });

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    allNotes.forEach((note) => note.tags.forEach((t) => tags.add(t)));
    return [...tags].sort();
  }, [allNotes]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        title: form.title,
        content: form.content,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      if (editing) {
        return updateResearchNote(editing.id, data);
      }
      return createResearchNote(projectId!, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', projectId] });
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? 'Note updated' : 'Note created');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteResearchNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', projectId] });
      toast.success('Note deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEdit = (note: ResearchNote) => {
    setEditing(note);
    setForm({
      title: note.title,
      content: note.content,
      tags: note.tags.join(', '),
    });
    setModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookMarked className="h-7 w-7 text-accent" /> Research Notes
          </h1>
          <p className="text-muted text-sm mt-1">{notes.length} notes</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setForm(emptyForm);
            setModalOpen(true);
          }}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" /> Add Note
        </button>
      </div>

      <div className="card space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="input pl-10"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className={cn(
                'badge cursor-pointer transition-colors',
                !activeTag ? 'bg-accent/20 text-accent' : 'bg-white/5 text-muted hover:bg-white/10',
              )}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={cn(
                  'badge cursor-pointer transition-colors',
                  activeTag === tag
                    ? 'bg-accent/20 text-accent'
                    : 'bg-white/5 text-muted hover:bg-white/10',
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {notes.length === 0 ? (
        <div className="card text-center py-16">
          <BookMarked className="h-12 w-12 mx-auto text-muted mb-4 opacity-40" />
          <p className="text-muted mb-4">
            {searchQuery || activeTag ? 'No matching notes.' : 'No research notes yet.'}
          </p>
          {!searchQuery && !activeTag && (
            <button type="button" onClick={() => setModalOpen(true)} className="btn-primary">
              <Plus className="h-4 w-4" /> Create Note
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {notes.map((note) => (
            <div key={note.id} className="card group hover:border-accent/30 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{note.title}</h3>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Delete this note?')) deleteMutation.mutate(note.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 btn-ghost p-1 text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-muted mt-2 line-clamp-4 whitespace-pre-wrap">
                {note.content || 'No content'}
              </p>
              {note.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {note.tags.map((tag) => (
                    <span key={tag} className="badge bg-accent/10 text-accent text-[10px]">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted">{new Date(note.createdAt).toLocaleDateString()}</p>
                <button type="button" onClick={() => openEdit(note)} className="btn-secondary text-xs">
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">
              {editing ? 'Edit Note' : 'New Research Note'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="label">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Content</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="input min-h-[120px]"
                />
              </div>
              <div>
                <label className="label">Tags (comma-separated)</label>
                <input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  className="input"
                  placeholder="history, setting, character"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                disabled={!form.title.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="btn-primary"
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
