import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, List, Loader2, PenLine, Sparkles, X } from 'lucide-react';
import { getChapter, getChapterHistory, listChapters, restoreChapter, updateChapter, createChapter } from '../api/chapters';
import { continueWriting } from '../api/casper';
import { getProject } from '../api/projects';
import { useAppStore } from '../store';
import { countWords } from '../lib/utils';
import { useToast } from '../components/Toast';
import { ImproveManuscriptPanel } from '../components/ImproveManuscriptPanel';
import { AIPanel } from '../components/AIPanel';
import { ChapterRail } from '../components/chapter/ChapterRail';
import { StagedProgressPanel } from '../components/StagedProgressPanel';
import { CONTINUE_STAGES } from '../components/StagedProgress';
import { finishBook } from '../api/book';

type SaveState = 'saved' | 'saving' | 'unsaved';

export default function ChapterEditor() {
  const { id: projectId, chapterId } = useParams<{ id: string; chapterId: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const setAiPanelOpen = useAppStore((s) => s.setAiPanelOpen);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [showImprove, setShowImprove] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showRail, setShowRail] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const initialized = useRef(false);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
  });

  const { data: chapter, isLoading } = useQuery({
    queryKey: ['chapter', chapterId],
    queryFn: () => getChapter(chapterId!),
    enabled: !!chapterId,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['chapter-history', chapterId],
    queryFn: () => getChapterHistory(chapterId!),
    enabled: showHistory && !!chapterId,
  });

  useEffect(() => {
    if (chapter && !initialized.current) {
      setTitle(chapter.title);
      setContent(chapter.content);
      initialized.current = true;
    }
  }, [chapter]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateChapter(chapterId!, {
        title,
        content,
        wordCount: countWords(content),
      }),
    onSuccess: () => {
      setSaveState('saved');
      queryClient.invalidateQueries({ queryKey: ['chapter', chapterId] });
      queryClient.invalidateQueries({ queryKey: ['chapters', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (err: Error) => {
      setSaveState('unsaved');
      toast.error(err.message);
    },
  });

  const continueMutation = useMutation({
    mutationFn: async () => {
      const result = await continueWriting({
        projectId: projectId!,
        chapterId: chapterId!,
        currentText: content,
        mode: 'continue',
      });
      const next = content + (content.endsWith('\n') ? '' : '\n\n') + result.text;
      await updateChapter(chapterId!, {
        title,
        content: next,
        wordCount: countWords(next),
      });
      return { result, next };
    },
    onSuccess: ({ result, next }) => {
      setContent(next);
      setSaveState('saved');
      queryClient.invalidateQueries({ queryKey: ['chapter', chapterId] });
      queryClient.invalidateQueries({ queryKey: ['outputs'] });
      toast.success(`Continued writing · saved output ${result.outputId.slice(0, 8)} (appended to chapter)`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const missingChapterMutation = useMutation({
    mutationFn: async (targetTitle: string) => {
      const result = await finishBook({
        projectId: projectId!,
        mode: 'fill-gap',
        desiredOutcome: targetTitle,
        currentText: content.slice(-2000),
      });
      const text = String(result.text ?? result.draft ?? '');
      if (!text.trim()) throw new Error('No draft returned — check AI engine status.');
      const chapters = await listChapters(projectId!);
      const chapter = await createChapter(projectId!, {
        title: targetTitle,
        order: chapters.length + 1,
        content: text,
        status: 'draft',
      });
      return { result, chapter };
    },
    onSuccess: ({ result, chapter }) => {
      queryClient.invalidateQueries({ queryKey: ['chapters', projectId] });
      queryClient.invalidateQueries({ queryKey: ['outputs'] });
      toast.success(`Gap chapter drafted · output ${String(result.outputId ?? '').slice(0, 8)}`);
      window.location.href = `/projects/${projectId}/chapters/${chapter.id}`;
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleContinueWriting() {
    const confirmed = confirm(
      'Continue writing will append AI text to this chapter. The continuation is also saved as a separate output.',
    );
    if (confirmed) continueMutation.mutate();
  }

  const restoreMutation = useMutation({
    mutationFn: (timestamp: string) => restoreChapter(chapterId!, timestamp),
    onSuccess: (restored) => {
      setTitle(restored.title);
      setContent(restored.content);
      setSaveState('saved');
      queryClient.invalidateQueries({ queryKey: ['chapter', chapterId] });
      queryClient.invalidateQueries({ queryKey: ['chapter-history', chapterId] });
      toast.success('Version restored');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const scheduleSave = useCallback(() => {
    setSaveState('unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveState('saving');
      saveMutation.mutate();
    }, 1500);
  }, [saveMutation]);

  const handleContentChange = (value: string) => {
    setContent(value);
    scheduleSave();
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    scheduleSave();
  };

  const handleSelection = () => {
    const sel = window.getSelection()?.toString() ?? '';
    setSelectedText(sel);
  };

  const handleInsert = (text: string) => {
    const next = content + (content.endsWith('\n') ? '' : '\n\n') + text;
    setContent(next);
    scheduleSave();
    toast.success('Text inserted');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#98711d]" />
      </div>
    );
  }

  if (!chapter) {
    return <p className="py-20 text-center text-muted">Chapter not found</p>;
  }

  const wordCount = countWords(content);

  return (
    <div className="fixed inset-0 z-30 flex min-h-dvh max-h-dvh flex-col overflow-hidden bg-[#f7f1e6] text-[#171a22]">
      <header className="shrink-0 border-b border-[#eadfca] bg-[#fffaf0]/92 px-3 py-2 shadow-sm backdrop-blur sm:px-4 md:px-6 md:py-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2 md:gap-4">
            <Link to={`/projects/${projectId}`} className="btn-ghost min-h-[44px] min-w-[44px] p-2">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <button
              type="button"
              className="btn-secondary min-h-[44px] text-xs lg:hidden"
              onClick={() => setShowRail(true)}
            >
              <List className="h-3.5 w-3.5" /> Chapters
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98711d] sm:text-xs">{project?.title}</p>
              <input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="mt-0.5 w-full min-w-0 bg-transparent font-serif text-lg font-semibold text-[#171a22] outline-none sm:text-2xl"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={handleContinueWriting}
              disabled={continueMutation.isPending || !content.trim()}
              className="btn-primary min-h-[44px] text-xs"
            >
              {continueMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
              Continue
            </button>
            <button
              type="button"
              onClick={() => setShowImprove((value) => !value)}
              disabled={!content.trim()}
              className="btn-secondary min-h-[44px] text-xs"
            >
              <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Improve</span>
            </button>
            <button type="button" onClick={() => setShowHistory(!showHistory)} className="btn-secondary min-h-[44px] text-xs">
              <Clock className="h-3.5 w-3.5" /> <span className="hidden sm:inline">History</span>
            </button>
            <button type="button" onClick={() => setAiPanelOpen(true)} className="btn-primary min-h-[44px] text-xs">
              <Sparkles className="h-3.5 w-3.5" /> Casper
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {projectId && chapterId && (
          <>
            <div className="hidden lg:flex">
              <ChapterRail
                projectId={projectId}
                currentChapterId={chapterId}
                onContinue={handleContinueWriting}
                onImprove={() => setShowImprove(true)}
                onWriteNextMissing={(title) => {
                  if (confirm(`Draft missing chapter "${title}"? Creates a new chapter — original preserved.`)) {
                    missingChapterMutation.mutate(title);
                  }
                }}
                continuePending={continueMutation.isPending}
              />
            </div>
            {showRail && (
              <div className="fixed inset-0 z-40 lg:hidden">
                <button type="button" className="absolute inset-0 bg-[#171a22]/45" aria-label="Close chapters" onClick={() => setShowRail(false)} />
                <div className="relative h-full max-w-xs">
                  <button type="button" className="absolute right-2 top-2 z-10 btn-ghost min-h-[44px] min-w-[44px] bg-white/90" onClick={() => setShowRail(false)}>
                    <X className="h-4 w-4" />
                  </button>
                  <ChapterRail
                    projectId={projectId}
                    currentChapterId={chapterId}
                    onContinue={handleContinueWriting}
                    onImprove={() => setShowImprove(true)}
                    onWriteNextMissing={(title) => {
                      if (confirm(`Draft missing chapter "${title}"? Creates a new chapter — original preserved.`)) {
                        missingChapterMutation.mutate(title);
                      }
                    }}
                    continuePending={continueMutation.isPending}
                    className="h-full max-h-dvh shadow-2xl"
                  />
                </div>
              </div>
            )}
          </>
        )}
        <main className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-5 sm:px-4 md:px-8 md:py-10">
          {(continueMutation.isPending || missingChapterMutation.isPending) && (
            <div className="progress-reserve mx-auto mb-6 max-w-4xl">
              <StagedProgressPanel
                label={missingChapterMutation.isPending ? 'Drafting missing chapter' : 'Continue writing'}
                stages={CONTINUE_STAGES}
                pending={continueMutation.isPending || missingChapterMutation.isPending}
                error={
                  continueMutation.isError
                    ? continueMutation.error.message
                    : missingChapterMutation.isError
                      ? missingChapterMutation.error.message
                      : null
                }
              />
            </div>
          )}
          {showImprove && project && content.trim() && (
            <div className="mx-auto mb-6 max-w-4xl">
              <ImproveManuscriptPanel
                compact
                projectId={projectId!}
                projectTitle={project.title}
                sourceChapterId={chapterId!}
                sourceChapterTitle={title}
                sourceText={content}
              />
            </div>
          )}
          <div className="mx-auto max-w-4xl rounded-[2rem] border border-[#eadfca] bg-[#fffdf8] p-4 shadow-room sm:p-6 md:p-10">
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onSelect={handleSelection}
              className="min-h-[50dvh] w-full resize-y bg-transparent font-serif text-lg leading-9 text-[#20202a] outline-none placeholder:text-[#b8aa91] sm:min-h-[58dvh] sm:text-xl sm:leading-10 md:text-2xl md:leading-[3.1rem]"
              placeholder="Start writing..."
            />
          </div>
        </main>

        {showHistory && (
          <aside className="custom-scrollbar fixed inset-y-0 right-0 z-20 w-full max-w-sm overflow-y-auto border-l border-[#eadfca] bg-[#fffaf0] p-4 shadow-2xl lg:static lg:w-80 lg:shadow-[inset_12px_0_30px_rgba(75,55,21,0.04)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-xl font-semibold text-[#171a22] sm:text-2xl">Version history</h3>
              <button type="button" className="btn-ghost min-h-[44px] lg:hidden" onClick={() => setShowHistory(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-muted">No history yet</p>
            ) : (
              <div className="space-y-2">
                {history.map((entry, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={restoreMutation.isPending}
                    onClick={() => {
                      if (confirm(`Restore version from ${new Date(entry.timestamp).toLocaleString()}?`)) {
                        restoreMutation.mutate(entry.timestamp);
                      }
                    }}
                    className="w-full rounded-2xl border border-[#eadfca] bg-white p-3 text-left shadow-sm transition hover:border-accent hover:bg-[#fff8e8] disabled:opacity-50"
                  >
                    <p className="text-xs text-muted">{new Date(entry.timestamp).toLocaleString()}</p>
                    <p className="mt-1 text-xs font-semibold text-[#171a22]">{entry.wordCount} words</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">{entry.preview}</p>
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#eadfca] bg-[#fffaf0]/92 px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-xs text-muted sm:px-6">
        <span>{project?.title}</span>
        <div className="flex items-center gap-4">
          <span>{wordCount.toLocaleString()} words</span>
          <span className="flex items-center gap-1">
            {saveState === 'saving' && <Loader2 className="h-3 w-3 animate-spin" />}
            {saveState === 'saved' && 'Saved'}
            {saveState === 'saving' && 'Saving...'}
            {saveState === 'unsaved' && 'Unsaved changes'}
          </span>
        </div>
      </footer>

      <AIPanel chapterId={chapterId} projectId={projectId} chapterContent={content} selectedText={selectedText} onInsert={handleInsert} />
    </div>
  );
}
