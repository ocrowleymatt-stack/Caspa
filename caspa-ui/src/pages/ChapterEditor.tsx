import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, Loader2 } from 'lucide-react';
import { getChapter, getChapterHistory, restoreChapter, updateChapter } from '../api/chapters';
import { getProject } from '../api/projects';
import { useAppStore } from '../store';
import { countWords } from '../lib/utils';
import { useToast } from '../components/Toast';
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
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!chapter) {
    return <p className="text-center text-muted py-20">Chapter not found</p>;
  }

  const wordCount = countWords(content);

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-3 bg-surface/80 backdrop-blur-sm">
        <div className="flex items-center gap-4 min-w-0">
          <Link to={`/projects/${projectId}`} className="btn-ghost p-1.5">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="bg-transparent text-lg font-semibold outline-none min-w-0 flex-1 font-serif"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="btn-secondary text-xs"
          >
            <Clock className="h-3.5 w-3.5" /> History
          </button>
          <button type="button" onClick={() => setAiPanelOpen(true)} className="btn-primary text-xs">
            AI Assistant
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-8 py-8 max-w-3xl mx-auto w-full">
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onSelect={handleSelection}
            className="min-h-[60vh] w-full resize-none bg-transparent font-serif text-lg leading-relaxed outline-none"
            placeholder="Start writing..."
          />
        </div>

        {showHistory && (
          <aside className="w-72 border-l border-white/10 bg-surface overflow-y-auto p-4">
            <h3 className="font-medium mb-3 text-sm">Version History</h3>
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
                    className="w-full text-left rounded-lg border border-white/10 p-3 hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    <p className="text-xs text-muted">{new Date(entry.timestamp).toLocaleString()}</p>
                    <p className="text-xs mt-1">{entry.wordCount} words</p>
                    <p className="text-xs text-muted mt-1 line-clamp-2">{entry.preview}</p>
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-white/10 px-6 py-2 bg-surface/80 text-xs text-muted">
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

      <AIPanel
        chapterId={chapterId}
        projectId={projectId}
        selectedText={selectedText}
        onInsert={handleInsert}
      />
    </div>
  );
}
