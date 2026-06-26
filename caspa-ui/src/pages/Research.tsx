import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookMarked,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { getProject } from '../api/projects';
import {
  checkResearchAccuracy,
  createResearchNote,
  deleteResearchNote,
  extractResearchClaims,
  listResearchNotes,
  queueResearchNote,
  runResearchDepthPass,
  suggestResearchTopics,
  updateResearchNote,
} from '../api/research';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';
import {
  VERIFICATION_LABELS,
  VERIFICATION_STYLES,
  type ResearchVerificationStatus,
} from '../lib/researchDesk';
import { useToast } from '../components/Toast';
import type { ResearchNote } from '../types';

const emptyForm = {
  title: '',
  content: '',
  tags: '',
  verificationStatus: 'unverified' as ResearchVerificationStatus,
  queueStatus: '' as '' | 'queued' | 'active' | 'done',
};

export default function Research() {
  const { id: projectId } = useParams<{ id: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const setResearchPassNoteIds = useAppStore((s) => s.setResearchPassNoteIds);
  const researchPassNoteIds = useAppStore((s) => s.researchPassNoteIds);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ResearchNote | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deskQuery, setDeskQuery] = useState('');
  const [accuracyText, setAccuracyText] = useState('');
  const [depthTopic, setDepthTopic] = useState('');
  const [topics, setTopics] = useState<Array<{ topic: string; reason: string; priority: string }>>([]);
  const [claims, setClaims] = useState<Array<{ id: string; text: string; status?: string; explanation?: string }>>([]);
  const [depthResult, setDepthResult] = useState<{
    summary: string;
    gaps: string[];
    suggestedQuestions: Array<{ topic: string; reason: string }>;
  } | null>(null);

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
  });

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['research', projectId],
    queryFn: () => listResearchNotes(projectId!),
    enabled: !!projectId,
  });

  const filteredNotes = useMemo(() => {
    let list = notes;
    if (activeTag) list = list.filter((note) => note.tags.includes(activeTag));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (note) =>
          note.title.toLowerCase().includes(q)
          || note.content.toLowerCase().includes(q)
          || note.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [notes, activeTag, searchQuery]);

  const queueNotes = useMemo(
    () => notes.filter((note) => note.queueStatus === 'queued' || note.queueStatus === 'active'),
    [notes],
  );

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach((note) => note.tags.forEach((t) => tags.add(t)));
    return [...tags].sort();
  }, [notes]);

  const confirmedNotes = useMemo(
    () => notes.filter((note) => note.verificationStatus === 'confirmed'),
    [notes],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        title: form.title,
        content: form.content,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        verificationStatus: form.verificationStatus,
        sourceType: 'user' as const,
        queueStatus: form.queueStatus || undefined,
      };
      if (editing) return updateResearchNote(editing.id, data);
      return createResearchNote(projectId!, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', projectId] });
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? 'Research updated' : 'Research added');
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

  const verifyMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ResearchVerificationStatus }) =>
      updateResearchNote(id, { verificationStatus: status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', projectId] });
      toast.success('Verification updated');
    },
  });

  const suggestMutation = useMutation({
    mutationFn: () => suggestResearchTopics(projectId!, { query: deskQuery || undefined }),
    onSuccess: (result) => {
      setTopics(result.topics);
      toast.success('Research topics suggested — all unverified until you confirm');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const extractMutation = useMutation({
    mutationFn: () => extractResearchClaims(projectId!, accuracyText),
    onSuccess: (result) => {
      setClaims(result.claims.map((claim) => ({ id: claim.id, text: claim.text })));
      toast.success(`${result.claims.length} claims extracted`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const accuracyMutation = useMutation({
    mutationFn: () =>
      checkResearchAccuracy(projectId!, {
        sourceText: accuracyText || undefined,
        claims: claims.length ? claims.map((c) => ({ id: c.id, text: c.text })) : undefined,
      }),
    onSuccess: (result) => {
      setClaims(
        result.verdicts.map((verdict) => ({
          id: verdict.claimId,
          text: verdict.claimText,
          status: verdict.status,
          explanation: verdict.explanation,
        })),
      );
      toast.success(
        result.confirmedLibraryUsed
          ? 'Accuracy check complete'
          : 'No confirmed library yet — verdicts remain unverified',
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const depthMutation = useMutation({
    mutationFn: () => runResearchDepthPass(projectId!, { topic: depthTopic || undefined }),
    onSuccess: (result) => {
      setDepthResult({
        summary: result.summary,
        gaps: result.gaps,
        suggestedQuestions: result.suggestedQuestions,
      });
      toast.success('Depth pass saved to Outputs');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEdit = (note: ResearchNote) => {
    setEditing(note);
    setForm({
      title: note.title,
      content: note.content,
      tags: note.tags.join(', '),
      verificationStatus: note.verificationStatus ?? 'unverified',
      queueStatus: note.queueStatus ?? '',
    });
    setModalOpen(true);
  };

  const addTopicToQueue = async (topic: string, reason: string) => {
    await createResearchNote(projectId!, {
      title: topic,
      content: reason,
      tags: ['research-queue', 'ai-suggestion'],
      verificationStatus: 'unverified',
      sourceType: 'ai-suggestion',
      queueStatus: 'queued',
    });
    queryClient.invalidateQueries({ queryKey: ['research', projectId] });
    toast.success('Added to research queue');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#98711d]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <section className="overflow-hidden rounded-[2.4rem] border border-[#eadfca] bg-white shadow-room">
        <div className="p-7 md:p-10">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {projectId && (
              <Link to={`/projects/${projectId}`} className="text-sm text-muted hover:text-[#171a22]">
                ← Back to project
              </Link>
            )}
            <span className="badge">Research Desk</span>
          </div>
          <h1 className="font-serif text-5xl font-semibold leading-none tracking-[-0.045em] text-[#171a22] md:text-6xl">
            {project?.title ?? 'Research Desk'}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted">
            Build a verified research library before drafting. AI suggestions stay unverified until you
            confirm them. User-confirmed notes outrank AI inference.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
                setModalOpen(true);
              }}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" /> Add research
            </button>
            <button
              type="button"
              onClick={() => {
                const ids = confirmedNotes.map((note) => note.id);
                setResearchPassNoteIds(ids);
                toast.success(`${ids.length} confirmed note(s) queued for next writing pass`);
              }}
              className="btn-secondary"
            >
              <CheckCircle2 className="h-4 w-4" /> Use confirmed in next pass
            </button>
            {researchPassNoteIds.length > 0 && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {researchPassNoteIds.length} confirmed note(s) armed
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-paper">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#98711d]" />
            <h2 className="font-serif text-2xl font-semibold text-[#171a22]">Ask Research Desk</h2>
          </div>
          <textarea
            value={deskQuery}
            onChange={(event) => setDeskQuery(event.target.value)}
            rows={3}
            placeholder="What needs researching for this project?"
            className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#caa044]"
          />
          <button
            type="button"
            onClick={() => suggestMutation.mutate()}
            disabled={suggestMutation.isPending}
            className="btn-primary mt-4"
          >
            {suggestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Suggest topics
          </button>
          {topics.length > 0 && (
            <ul className="mt-4 space-y-3">
              {topics.map((topic) => (
                <li key={topic.topic} className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-4 text-sm">
                  <div className="font-semibold text-[#171a22]">{topic.topic}</div>
                  <p className="mt-1 text-[#5f5648]">{topic.reason}</p>
                  <button
                    type="button"
                    onClick={() => addTopicToQueue(topic.topic, topic.reason)}
                    className="btn-secondary mt-3 text-xs"
                  >
                    Add to queue
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-paper">
          <div className="mb-4 flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-[#98711d]" />
            <h2 className="font-serif text-2xl font-semibold text-[#171a22]">Depth pass</h2>
          </div>
          <input
            value={depthTopic}
            onChange={(event) => setDepthTopic(event.target.value)}
            placeholder="Topic to deepen (optional)"
            className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#caa044]"
          />
          <button
            type="button"
            onClick={() => depthMutation.mutate()}
            disabled={depthMutation.isPending}
            className="btn-secondary mt-4"
          >
            {depthMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Run depth pass
          </button>
          {depthResult && (
            <div className="mt-4 space-y-3 text-sm text-[#5f5648]">
              <p>{depthResult.summary}</p>
              <ul className="list-disc pl-5">
                {depthResult.gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-paper">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-[#98711d]" />
          <h2 className="font-serif text-2xl font-semibold text-[#171a22]">Accuracy check</h2>
        </div>
        <textarea
          value={accuracyText}
          onChange={(event) => setAccuracyText(event.target.value)}
          rows={5}
          placeholder="Paste manuscript text with factual claims…"
          className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#caa044]"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => extractMutation.mutate()} disabled={extractMutation.isPending || !accuracyText.trim()} className="btn-secondary">
            Extract claims
          </button>
          <button type="button" onClick={() => accuracyMutation.mutate()} disabled={accuracyMutation.isPending || (!accuracyText.trim() && claims.length === 0)} className="btn-primary">
            Check accuracy
          </button>
        </div>
        {claims.length > 0 && (
          <ul className="mt-4 space-y-2">
            {claims.map((claim) => (
              <li key={claim.id} className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-3 text-sm">
                <div className="text-[#171a22]">{claim.text}</div>
                {claim.status && (
                  <div className="mt-1 text-xs uppercase tracking-[0.14em] text-[#98711d]">
                    {claim.status} · {claim.explanation}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {queueNotes.length > 0 && (
        <section className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#98711d]">Research queue</div>
          {queueNotes.map((note) => (
            <div key={note.id} className="rounded-[1.5rem] border border-[#eadfca] bg-[#fffdf8] p-4">
              <div className="font-semibold text-[#171a22]">{note.title}</div>
              <p className="mt-1 text-sm text-[#5f5648]">{note.content}</p>
              <button
                type="button"
                onClick={() => queueResearchNote(note.id, 'done').then(() => queryClient.invalidateQueries({ queryKey: ['research', projectId] }))}
                className="btn-secondary mt-3 text-xs"
              >
                Mark done
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#98711d]">Research library</div>
            <h2 className="mt-1 font-serif text-3xl font-semibold text-[#171a22]">
              {filteredNotes.length} notes · {confirmedNotes.length} confirmed
            </h2>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[#eadfca] bg-white p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search library…"
              className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#caa044]"
            />
          </div>
          {allTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setActiveTag(null)} className={cn('rounded-full px-3 py-1 text-xs', !activeTag ? 'bg-[#171a22] text-white' : 'bg-[#fffdf8] text-muted border border-[#eadfca]')}>
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs border border-[#eadfca]',
                    activeTag === tag ? 'bg-[#171a22] text-white' : 'bg-[#fffdf8] text-muted',
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {filteredNotes.length === 0 ? (
          <div className="rounded-[2rem] border border-[#eadfca] bg-white/85 py-14 text-center shadow-paper">
            <BookMarked className="mx-auto mb-4 h-12 w-12 text-[#98711d] opacity-60" />
            <p className="text-muted">No research notes yet. Add sources before drafting factual passages.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredNotes.map((note) => {
              const status: ResearchVerificationStatus = note.verificationStatus ?? 'unverified';
              return (
                <div key={note.id} className="group rounded-[1.6rem] border border-[#eadfca] bg-white p-5 shadow-paper">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif text-xl font-semibold text-[#171a22]">{note.title}</h3>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Delete this note?')) deleteMutation.mutate(note.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <span className={cn('mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]', VERIFICATION_STYLES[status])}>
                    {VERIFICATION_LABELS[status]}
                  </span>
                  <p className="mt-3 line-clamp-4 text-sm leading-7 text-[#5f5648] whitespace-pre-wrap">
                    {note.content || 'No content'}
                  </p>
                  {note.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {note.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-[#fffdf8] px-2 py-0.5 text-[10px] text-[#98711d]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => openEdit(note)} className="btn-secondary text-xs">
                      Edit
                    </button>
                    {status !== 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => verifyMutation.mutate({ id: note.id, status: 'confirmed' })}
                        className="btn-secondary text-xs"
                      >
                        Confirm
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F19]/60 p-4 backdrop-blur-md">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-room">
            <h2 className="font-serif text-2xl font-semibold text-[#171a22]">
              {editing ? 'Edit research' : 'Add research'}
            </h2>
            <div className="mt-5 space-y-4">
              <label className="block text-sm">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Title</span>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 outline-none focus:border-[#caa044]" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Content</span>
                <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 outline-none focus:border-[#caa044]" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Tags</span>
                <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="history, harbour, 1890s" className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 outline-none focus:border-[#caa044]" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Verification</span>
                <select value={form.verificationStatus} onChange={(e) => setForm({ ...form, verificationStatus: e.target.value as ResearchVerificationStatus })} className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 outline-none focus:border-[#caa044]">
                  {Object.entries(VERIFICATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
              <button type="button" disabled={!form.title.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()} className="btn-primary">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
