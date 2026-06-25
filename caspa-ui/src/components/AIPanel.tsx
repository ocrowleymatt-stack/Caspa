import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  BookOpen,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import {
  checkConsistency,
  continueChapter,
  critiqueChapter,
  generateSummary,
  generateTitles,
  rewriteSelection,
  streamGenerate,
  styleLock,
  suggestPlotPoints,
} from '../api/assistant';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';
import { useToast } from './Toast';

interface AIPanelProps {
  chapterId?: string;
  projectId?: string;
  selectedText?: string;
  onInsert?: (text: string) => void;
}

export function AIPanel({ chapterId, projectId, selectedText, onInsert }: AIPanelProps) {
  const open = useAppStore((s) => s.aiPanelOpen);
  const setOpen = useAppStore((s) => s.setAiPanelOpen);
  const toast = useToast();
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [streaming, setStreaming] = useState(false);

  const streamMutation = useMutation({
    mutationFn: async (userPrompt: string) => {
      setResponse('');
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
    onSuccess: () => toast.success('AI response complete'),
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setStreaming(false),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'continue' && chapterId) {
        return continueChapter(chapterId);
      }
      if (action === 'rewrite' && selectedText && projectId) {
        return rewriteSelection(selectedText, prompt || 'Improve this text', projectId);
      }
      if (action === 'critique' && chapterId) {
        const result = await critiqueChapter(chapterId);
        return `Strengths:\n${result.strengths.map((s) => `• ${s}`).join('\n')}\n\nWeaknesses:\n${result.weaknesses.map((s) => `• ${s}`).join('\n')}\n\nSuggestions:\n${result.suggestions.map((s) => `• ${s}`).join('\n')}`;
      }
      if (action === 'consistency' && projectId) {
        const result = await checkConsistency(projectId);
        return `Issues:\n${result.issues.map((s) => `• ${s}`).join('\n') || 'None'}\n\nWarnings:\n${result.warnings.map((s) => `• ${s}`).join('\n') || 'None'}`;
      }
      if (action === 'summary' && chapterId) {
        return generateSummary(chapterId);
      }
      if (action === 'titles' && projectId) {
        const titles = await generateTitles(projectId);
        return titles.map((t, i) => `${i + 1}. ${t}`).join('\n');
      }
      if (action === 'plot-suggest' && projectId) {
        const points = await suggestPlotPoints(projectId);
        return points.map((p, i) => `${i + 1}. [${p.type}] ${p.title}\n   ${p.description}`).join('\n\n');
      }
      if (action === 'style-lock' && selectedText) {
        return styleLock(selectedText, prompt || 'Match this writing style');
      }
      throw new Error('Action not available');
    },
    onSuccess: (text) => {
      setResponse(text);
      toast.success('AI action complete');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!open) return null;

  const busy = streaming || actionMutation.isPending || streamMutation.isPending;

  return (
    <aside className="fixed right-0 top-0 z-40 flex h-full w-96 flex-col border-l border-white/10 bg-surface shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <h2 className="font-semibold">AI Assistant</h2>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost p-1.5">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/10 p-3">
        {chapterId && (
          <button
            type="button"
            disabled={busy}
            onClick={() => actionMutation.mutate('continue')}
            className="btn-secondary text-xs py-1.5"
          >
            <Wand2 className="h-3 w-3" /> Continue
          </button>
        )}
        {selectedText && projectId && (
          <button
            type="button"
            disabled={busy}
            onClick={() => actionMutation.mutate('rewrite')}
            className="btn-secondary text-xs py-1.5"
          >
            <RefreshCw className="h-3 w-3" /> Rewrite
          </button>
        )}
        {chapterId && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => actionMutation.mutate('critique')}
              className="btn-secondary text-xs py-1.5"
            >
              Critique
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => actionMutation.mutate('summary')}
              className="btn-secondary text-xs py-1.5"
            >
              Summary
            </button>
          </>
        )}
        {projectId && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => actionMutation.mutate('consistency')}
              className="btn-secondary text-xs py-1.5"
            >
              Consistency
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => actionMutation.mutate('titles')}
              className="btn-secondary text-xs py-1.5"
            >
              <BookOpen className="h-3 w-3" /> Titles
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => actionMutation.mutate('plot-suggest')}
              className="btn-secondary text-xs py-1.5"
            >
              Plot
            </button>
          </>
        )}
        {selectedText && (
          <button
            type="button"
            disabled={busy}
            onClick={() => actionMutation.mutate('style-lock')}
            className="btn-secondary text-xs py-1.5"
          >
            Style Lock
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {busy && !response && (
          <div className="flex items-center justify-center py-12 text-muted">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Thinking...
          </div>
        )}
        {response ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <p className="whitespace-pre-wrap font-serif text-sm leading-relaxed">{response}</p>
          </div>
        ) : !busy ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted">
            <MessageSquare className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Ask anything about your manuscript</p>
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/10 p-4 space-y-2">
        {response && onInsert && (
          <button
            type="button"
            onClick={() => onInsert(response)}
            className="btn-secondary w-full text-xs"
          >
            Insert into chapter
          </button>
        )}
        <div className="flex gap-2">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && prompt.trim() && !busy) {
                streamMutation.mutate(prompt);
              }
            }}
            placeholder="Ask the AI..."
            className="input flex-1"
            disabled={busy}
          />
          <button
            type="button"
            disabled={!prompt.trim() || busy}
            onClick={() => streamMutation.mutate(prompt)}
            className="btn-primary px-3"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}

export function AIPanelToggle() {
  const toggle = useAppStore((s) => s.toggleAiPanel);
  const open = useAppStore((s) => s.aiPanelOpen);

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn('btn-secondary', open && 'border-accent text-accent')}
    >
      <Sparkles className="h-4 w-4" />
      AI
    </button>
  );
}
