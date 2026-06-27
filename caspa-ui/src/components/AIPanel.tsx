import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  FilePlus,
  Loader2,
  MessageSquare,
  NotebookPen,
  RefreshCw,
  Send,
  Sparkles,
  SplitSquareHorizontal,
  Wand2,
  X,
} from 'lucide-react';
import {
  checkConsistency,
  critiqueChapter,
  generateSummary,
  generateTitles,
  rewriteSelection,
  streamGenerate,
  styleLock,
  suggestPlotPoints,
} from '../api/assistant';
import { continueWriting } from '../api/casper';
import { patchProjectBible, getProjectBible } from '../api/bible';
import { createProjectSnapshot } from '../api/book';
import { getChapter, listChapters, createChapter, updateChapter } from '../api/chapters';
import { registerOutput } from '../api/outputs';
import { createResearchNote } from '../api/research';
import { useAppStore } from '../store';
import { cn, countWords } from '../lib/utils';
import { useToast } from './Toast';
import { ProviderStatus } from './ProviderStatus';
import { useBodyScrollLock, useEscapeKey } from '../hooks/useOverlay';

const actionClass =
  'rounded-2xl border border-[#eadfca] bg-white/75 px-3 py-2 text-xs font-semibold text-[#5f5648] shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:bg-[#fff8e8] disabled:opacity-50 disabled:hover:translate-y-0';

const pushClass =
  'btn-secondary flex-1 min-w-[9rem] text-xs justify-center';

function draftTitle(prompt: string, fallback: string) {
  const trimmed = prompt.trim();
  if (!trimmed) return fallback;
  return trimmed.length > 72 ? `${trimmed.slice(0, 72)}…` : trimmed;
}

export function AIPanel() {
  const open = useAppStore((s) => s.aiPanelOpen);
  const setOpen = useAppStore((s) => s.setAiPanelOpen);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const editorContext = useAppStore((s) => s.aiPanelEditorContext);
  const routeParams = useParams<{ id?: string; chapterId?: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [savedOutputId, setSavedOutputId] = useState<string | null>(null);

  const projectId = editorContext?.projectId ?? routeParams.id ?? activeProjectId ?? undefined;
  const chapterId = editorContext?.chapterId ?? routeParams.chapterId;
  const chapterContent = editorContext?.chapterContent;
  const selectedText = editorContext?.selectedText;
  const onInsert = editorContext?.insertText;

  const { data: routeChapter } = useQuery({
    queryKey: ['chapter', chapterId],
    queryFn: () => getChapter(chapterId!),
    enabled: !!chapterId && !editorContext,
  });

  const close = useCallback(() => setOpen(false), [setOpen]);
  useEscapeKey(open, close);
  useBodyScrollLock(open);

  const effectiveChapterContent = chapterContent ?? routeChapter?.content ?? '';
  const effectiveChapterTitle = editorContext?.chapterTitle ?? routeChapter?.title;

  const streamMutation = useMutation({
    mutationFn: async (userPrompt: string) => {
      setResponse('');
      setSavedOutputId(null);
      setStreaming(true);
      let full = '';
      await streamGenerate(
        {
          prompt: userPrompt,
          chapterId,
          projectId,
        },
        (chunk) => {
          full += chunk;
          setResponse(full);
        },
      );
      return full;
    },
    onSuccess: () => toast.success('Casper finished'),
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setStreaming(false),
  });

  const saveHistoryMutation = useMutation({
    mutationFn: async () => {
      if (!response.trim()) throw new Error('Nothing to save yet.');
      const record = await registerOutput({
        projectId,
        type: 'ask-casper',
        title: draftTitle(prompt, 'Ask Casper reply'),
        metadata: {
          text: response,
          prompt: prompt.trim() || undefined,
          chapterId,
          destination: chapterId ? 'current-chapter' : 'writing-history',
          source: 'ask-casper',
        },
      });
      return record;
    },
    onSuccess: (record) => {
      setSavedOutputId(record.id);
      queryClient.invalidateQueries({ queryKey: ['outputs'] });
      toast.success('Saved to Writing History');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pushAppendMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !chapterId || !response.trim()) {
        throw new Error('Open a chapter to append this draft.');
      }
      if (editorContext?.insertText) {
        editorContext.insertText(response);
        return { mode: 'live-editor' as const };
      }
      if (projectId) {
        await createProjectSnapshot(projectId, {
          label: 'Before Casper append',
          reason: 'ask-casper-append',
        });
      }
      const base = effectiveChapterContent;
      const next = base + (base.endsWith('\n') ? '' : '\n\n') + response;
      await updateChapter(chapterId, {
        content: next,
        wordCount: countWords(next),
      });
      return { mode: 'saved-chapter' as const };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapter', chapterId] });
      queryClient.invalidateQueries({ queryKey: ['chapters', projectId] });
      toast.success('Appended to current section');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pushReplaceMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !chapterId || !response.trim()) {
        throw new Error('Open a chapter to replace text.');
      }
      if (selectedText?.trim() && editorContext?.replaceSelection) {
        editorContext.replaceSelection(response);
        return { mode: 'selection' as const };
      }
      if (projectId) {
        await createProjectSnapshot(projectId, {
          label: 'Before Casper replace',
          reason: 'ask-casper-replace',
        });
      }
      await updateChapter(chapterId, {
        content: response,
        wordCount: countWords(response),
      });
      return { mode: 'chapter' as const };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapter', chapterId] });
      queryClient.invalidateQueries({ queryKey: ['chapters', projectId] });
      toast.success('Section updated from Casper draft');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pushNewSectionMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !response.trim()) throw new Error('Select a project first.');
      const chapters = await listChapters(projectId);
      const title = draftTitle(prompt, `Casper draft ${chapters.length + 1}`);
      return createChapter(projectId, {
        title,
        order: chapters.length + 1,
        content: response,
        status: 'draft',
      });
    },
    onSuccess: (chapter) => {
      queryClient.invalidateQueries({ queryKey: ['chapters', projectId] });
      toast.success(`New section created · ${chapter.title}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pushResearchMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !response.trim()) throw new Error('Select a project first.');
      return createResearchNote(projectId, {
        title: draftTitle(prompt, 'Ask Casper note'),
        content: response,
        tags: ['ask-casper'],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', projectId] });
      toast.success('Saved to research notes');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pushBibleMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !response.trim()) throw new Error('Select a project first.');
      const bible = await getProjectBible(projectId);
      const stamp = new Date().toLocaleString();
      const block = `\n\n---\nAsk Casper · ${stamp}\n${prompt.trim() ? `Q: ${prompt.trim()}\n\n` : ''}${response.trim()}`;
      return patchProjectBible(projectId, {
        sourceNotes: `${bible.sourceNotes ?? ''}${block}`.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-bible', projectId] });
      toast.success('Added to Project Bible notes');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'continue' && projectId && effectiveChapterContent.trim()) {
        const result = await continueWriting({
          projectId,
          chapterId,
          currentText: effectiveChapterContent,
          mode: 'continue',
        });
        return { text: result.text, outputId: result.outputId };
      }
      if (action === 'continue' && chapterId) {
        throw new Error('Add chapter text first, or open the chapter editor.');
      }
      if (action === 'rewrite' && selectedText && projectId) {
        const text = await rewriteSelection(selectedText, prompt || 'Improve this text', projectId);
        return { text };
      }
      if (action === 'critique' && chapterId) {
        const result = await critiqueChapter(chapterId);
        const text = `Strengths:\n${result.strengths.map((s) => `• ${s}`).join('\n')}\n\nWeaknesses:\n${result.weaknesses.map((s) => `• ${s}`).join('\n')}\n\nSuggestions:\n${result.suggestions.map((s) => `• ${s}`).join('\n')}`;
        return { text };
      }
      if (action === 'consistency' && projectId) {
        const result = await checkConsistency(projectId);
        const text = `Issues:\n${result.issues.map((s) => `• ${s}`).join('\n') || 'None'}\n\nWarnings:\n${result.warnings.map((s) => `• ${s}`).join('\n') || 'None'}`;
        return { text };
      }
      if (action === 'summary' && chapterId) {
        const text = await generateSummary(chapterId);
        return { text };
      }
      if (action === 'titles' && projectId) {
        const titles = await generateTitles(projectId);
        const text = titles.map((t, i) => `${i + 1}. ${t}`).join('\n');
        return { text };
      }
      if (action === 'plot-suggest' && projectId) {
        const points = await suggestPlotPoints(projectId);
        const text = points.map((p, i) => `${i + 1}. [${p.type}] ${p.title}\n   ${p.description}`).join('\n\n');
        return { text };
      }
      if (action === 'style-lock' && selectedText) {
        const text = await styleLock(selectedText, prompt || 'Match this writing style');
        return { text };
      }
      throw new Error('Action not available');
    },
    onSuccess: (result) => {
      setResponse(result.text);
      if (result.outputId) setSavedOutputId(result.outputId);
      queryClient.invalidateQueries({ queryKey: ['outputs'] });
      toast.success('Casper finished — push into project below');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pushPending = useMemo(
    () =>
      pushAppendMutation.isPending
      || pushReplaceMutation.isPending
      || pushNewSectionMutation.isPending
      || pushResearchMutation.isPending
      || pushBibleMutation.isPending
      || saveHistoryMutation.isPending,
    [
      pushAppendMutation.isPending,
      pushBibleMutation.isPending,
      pushNewSectionMutation.isPending,
      pushReplaceMutation.isPending,
      pushResearchMutation.isPending,
      saveHistoryMutation.isPending,
    ],
  );

  if (!open) return null;

  const busy = streaming || actionMutation.isPending || streamMutation.isPending || pushPending;
  const hasQuickActions = Boolean(
    chapterId || (selectedText && projectId) || projectId || selectedText,
  );
  const canPushToChapter = Boolean(projectId && chapterId && response.trim());
  const canPushToProject = Boolean(projectId && response.trim());

  function handleReplaceChapter() {
    const label = effectiveChapterTitle ? `"${effectiveChapterTitle}"` : 'this section';
    const confirmed = confirm(
      selectedText?.trim()
        ? 'Replace the selected text with this Casper draft?'
        : `Replace all text in ${label}? A project snapshot is created first.`,
    );
    if (confirmed) pushReplaceMutation.mutate();
  }

  function handleAppendChapter() {
    const confirmed = confirm(
      'Append this Casper draft to the current section? A snapshot is created if saving directly to the chapter.',
    );
    if (confirmed) pushAppendMutation.mutate();
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close Casper panel"
        className="fixed inset-0 z-[84] bg-[#171a22]/55 backdrop-blur-md"
        onClick={close}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Ask Casper"
        className="fixed inset-y-0 right-0 z-[85] flex h-dvh max-h-dvh w-full min-w-0 max-w-[27rem] flex-col border-l border-[#eadfca] bg-[#fffaf0] shadow-[0_0_80px_rgba(75,55,21,0.18)]"
      >
        <div className="shrink-0 border-b border-[#eadfca] px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">
                <Sparkles className="h-4 w-4 shrink-0" /> Casper
              </div>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-[#171a22] sm:text-3xl">Ask Casper</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Ask a question, then push the answer into your manuscript, bible, or research.
              </p>
            </div>
            <button type="button" onClick={close} className="btn-ghost min-h-[44px] min-w-[44px] shrink-0 p-2" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          {projectId && (
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#766b58]">
              <span className="rounded-full border border-[#eadfca] bg-white px-2.5 py-1">Project linked</span>
              {chapterId && (
                <span className="rounded-full border border-[#caa044] bg-[#fff8e8] px-2.5 py-1">
                  {effectiveChapterTitle ?? 'Current section'}
                </span>
              )}
            </div>
          )}
          <ProviderStatus compact className="mt-3 max-w-full" />
        </div>

        {hasQuickActions && (
          <div className="shrink-0 border-b border-[#eadfca] p-3 sm:p-4">
            <button
              type="button"
              onClick={() => setShowActions((value) => !value)}
              className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#98711d] lg:hidden"
            >
              {showActions ? 'Hide quick actions' : 'Show quick actions'}
            </button>
            <div className={cn('grid grid-cols-2 gap-2', !showActions && 'hidden lg:grid')}>
              {chapterId && (
                <button type="button" disabled={busy} onClick={() => actionMutation.mutate('continue')} className={actionClass}>
                  <Wand2 className="mr-1 inline h-3.5 w-3.5 text-[#98711d]" /> Continue
                </button>
              )}
              {selectedText && projectId && (
                <button type="button" disabled={busy} onClick={() => actionMutation.mutate('rewrite')} className={actionClass}>
                  <RefreshCw className="mr-1 inline h-3.5 w-3.5 text-[#98711d]" /> Rewrite
                </button>
              )}
              {chapterId && (
                <>
                  <button type="button" disabled={busy} onClick={() => actionMutation.mutate('critique')} className={actionClass}>
                    Critique
                  </button>
                  <button type="button" disabled={busy} onClick={() => actionMutation.mutate('summary')} className={actionClass}>
                    Summary
                  </button>
                </>
              )}
              {projectId && (
                <>
                  <button type="button" disabled={busy} onClick={() => actionMutation.mutate('consistency')} className={actionClass}>
                    Consistency
                  </button>
                  <button type="button" disabled={busy} onClick={() => actionMutation.mutate('titles')} className={actionClass}>
                    <BookOpen className="mr-1 inline h-3.5 w-3.5 text-[#98711d]" /> Titles
                  </button>
                  <button type="button" disabled={busy} onClick={() => actionMutation.mutate('plot-suggest')} className={actionClass}>
                    Plot
                  </button>
                </>
              )}
              {selectedText && (
                <button type="button" disabled={busy} onClick={() => actionMutation.mutate('style-lock')} className={actionClass}>
                  Style Lock
                </button>
              )}
            </div>
          </div>
        )}

        <div className="custom-scrollbar min-h-[10rem] min-w-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {busy && !response && (
            <div className="flex min-h-[10rem] items-center justify-center rounded-[1.5rem] border border-[#eadfca] bg-white/75 py-12 text-muted shadow-paper sm:rounded-[2rem]">
              <Loader2 className="mr-2 h-6 w-6 animate-spin text-[#98711d]" />
              Casper is thinking...
            </div>
          )}
          {response ? (
            <div className="rounded-[1.5rem] border border-[#eadfca] bg-[#fffdf8] p-4 shadow-paper sm:rounded-[2rem] sm:p-5">
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">Response</div>
              <p className="whitespace-pre-wrap break-words font-serif text-base leading-8 text-[#28241f]">{response}</p>
            </div>
          ) : !busy ? (
            <div className="flex min-h-[10rem] flex-col items-center justify-center rounded-[1.5rem] border border-[#eadfca] bg-white/75 px-4 py-10 text-center text-muted shadow-paper sm:rounded-[2rem] sm:px-6 sm:py-14">
              <MessageSquare className="mb-4 h-10 w-10 text-[#98711d] opacity-70" />
              <p className="font-serif text-xl font-semibold text-[#171a22] sm:text-2xl">Your conversation appears here.</p>
              <p className="mt-2 max-w-xs text-sm leading-6">
                Ask about structure, tone, the next scene, or paste a problem — then push the answer into the project.
              </p>
              {!projectId && (
                <p className="mt-4 text-xs leading-5 text-[#98711d]">
                  Open a project to push drafts into manuscript, bible, or research.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 space-y-3 border-t border-[#eadfca] bg-white/55 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
          {response && canPushToProject && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#98711d]">Push into project</div>
              <div className="flex flex-wrap gap-2">
                {canPushToChapter && (
                  <>
                    {onInsert && (
                      <button type="button" onClick={() => onInsert(response)} className={pushClass}>
                        <SplitSquareHorizontal className="h-3.5 w-3.5" /> Insert in editor
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={pushPending}
                      onClick={handleAppendChapter}
                      className={pushClass}
                    >
                      <SplitSquareHorizontal className="h-3.5 w-3.5" />
                      Append section
                    </button>
                    <button
                      type="button"
                      disabled={pushPending}
                      onClick={handleReplaceChapter}
                      className={pushClass}
                    >
                      {selectedText?.trim() ? 'Replace selection' : 'Replace section'}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={pushPending}
                  onClick={() => pushNewSectionMutation.mutate()}
                  className={pushClass}
                >
                  <FilePlus className="h-3.5 w-3.5" /> New section
                </button>
                <button
                  type="button"
                  disabled={pushPending}
                  onClick={() => pushResearchMutation.mutate()}
                  className={pushClass}
                >
                  <NotebookPen className="h-3.5 w-3.5" /> Research note
                </button>
                <button
                  type="button"
                  disabled={pushPending}
                  onClick={() => pushBibleMutation.mutate()}
                  className={pushClass}
                >
                  <BookOpen className="h-3.5 w-3.5" /> Bible notes
                </button>
                <button
                  type="button"
                  disabled={saveHistoryMutation.isPending}
                  onClick={() => saveHistoryMutation.mutate()}
                  className={pushClass}
                >
                  {saveHistoryMutation.isPending ? 'Saving…' : 'Writing History'}
                </button>
              </div>
              {savedOutputId && (
                <Link to={`/outputs/${savedOutputId}`} className="text-xs font-semibold text-[#98711d] hover:underline">
                  Open saved draft in Writing History →
                </Link>
              )}
              {projectId && (
                <Link to={`/projects/${projectId}/manuscript`} className="text-xs font-semibold text-[#98711d] hover:underline">
                  Open current work →
                </Link>
              )}
            </div>
          )}
          <div className="flex min-w-0 gap-2">
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && prompt.trim() && !busy) {
                  streamMutation.mutate(prompt);
                }
              }}
              placeholder="Ask Casper..."
              className="input min-w-0 flex-1"
              disabled={busy}
            />
            <button
              type="button"
              disabled={!prompt.trim() || busy}
              onClick={() => streamMutation.mutate(prompt)}
              className="btn-primary shrink-0 px-3"
              aria-label="Send to Casper"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export function AIPanelToggle() {
  const toggle = useAppStore((s) => s.toggleAiPanel);
  const open = useAppStore((s) => s.aiPanelOpen);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      aria-label="Ask Casper"
      className={cn('btn-secondary min-h-[44px] shrink-0', open && 'border-accent text-[#98711d]')}
    >
      <Sparkles className="h-4 w-4" />
      <span className="hidden sm:inline">Ask Casper</span>
      <span className="sm:hidden">Casper</span>
    </button>
  );
}
