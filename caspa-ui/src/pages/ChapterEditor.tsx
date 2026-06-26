import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, Loader2, PenLine, Sparkles } from 'lucide-react';
import { getChapter, getChapterHistory, restoreChapter, updateChapter } from '../api/chapters';
import { continueWriting } from '../api/casper';
import { getProject } from '../api/projects';
import { useAppStore } from '../store';
import { countWords } from '../lib/utils';
import { useToast } from '../components/Toast';
import { ImproveManuscriptPanel } from '../components/ImproveManuscriptPanel';
import { AIPanel } from '../components/AIPanel';

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
    <div className="fixed inset-0 z-30 flex flex-col bg-[#f7f1e6] text-[#171a22]">
      <header className="flex items-center justify-between border-b border-[#eadfca] bg-[#fffaf0]/92 px-4 py-3 shadow-sm backdrop-blur md:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link to={`/projects/${projectId}`} className="btn-ghost p-2">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-[#98711d]">{project?.title}</p>
            <input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="mt-1 w-full min-w-0 bg-transparent font-serif text-2xl font-semibold text-[#171a22] outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => continueMutation.mutate()}
            disabled={continueMutation.isPending || !content.trim()}
            className="btn-primary text-xs"
          >
            {continueMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
            Continue writing
          </button>
          <button
            type="button"
            onClick={() => setShowImprove((value) => !value)}
            disabled={!content.trim()}
            className="btn-secondary text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" /> Improve this manuscript
          </button>
          <button type="button" onClick={() => setShowHistory(!showHistory)} className="btn-secondary text-xs">
            <Clock className="h-3.5 w-3.5" /> History
          </button>
          <button type="button" onClick={() => setAiPanelOpen(true)} className="btn-primary text-xs">
            <Sparkles className="h-3.5 w-3.5" /> Casper
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="custom-scrollbar flex-1 overflow-y-auto px-4 py-7 md:px-8 md:py-10">
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
          <div className="mx-auto max-w-4xl rounded-[2rem] border border-[#eadfca] bg-[#fffdf8] p-6 shadow-room md:p-10">
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onSelect={handleSelection}
              className="min-h-[68vh] w-full resize-none bg-transparent font-serif text-xl leading-10 text-[#20202a] outline-none placeholder:text-[#b8aa91] md:text-2xl md:leading-[3.1rem]"
              placeholder="Start writing..."
            />
          </div>
        </main>

        {showHistory && (
          <aside className="custom-scrollbar w-80 overflow-y-auto border-l border-[#eadfca] bg-[#fffaf0] p-4 shadow-[inset_12px_0_30px_rgba(75,55,21,0.04)]">
            <h3 className="mb-3 font-serif text-2xl font-semibold text-[#171a22]">Version history</h3>
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

      <footer className="flex items-center justify-between border-t border-[#eadfca] bg-[#fffaf0]/92 px-6 py-2 text-xs text-muted">
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
