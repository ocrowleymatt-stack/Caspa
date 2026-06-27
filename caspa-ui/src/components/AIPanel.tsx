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
  critiqueChapter,
  generateSummary,
  generateTitles,
  rewriteSelection,
  streamGenerate,
  styleLock,
  suggestPlotPoints,
} from '../api/assistant';
import { continueWriting } from '../api/casper';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';
import { useToast } from './Toast';
import { ProviderStatus } from './ProviderStatus';

interface AIPanelProps {
  chapterId?: string;
  projectId?: string;
  chapterContent?: string;
  selectedText?: string;
  onInsert?: (text: string) => void;
}

const actionClass = 'rounded-2xl border border-[#eadfca] bg-white/75 px-3 py-2 text-xs font-semibold text-[#5f5648] shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:bg-[#fff8e8] disabled:opacity-50 disabled:hover:translate-y-0';

export function AIPanel({ chapterId, projectId, chapterContent, selectedText, onInsert }: AIPanelProps) {
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
    onSuccess: () => toast.success('Casper finished'),
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setStreaming(false),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'continue' && projectId && chapterContent?.trim()) {
        const result = await continueWriting({
          projectId,
          chapterId,
          currentText: chapterContent,
          mode: 'continue',
        });
        return result.text;
      }
      if (action === 'continue' && chapterId) {
        throw new Error('Save your chapter first, or use the header Continue writing button with live text.');
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
      toast.success('Casper finished');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!open) return null;

  const busy = streaming || actionMutation.isPending || streamMutation.isPending;

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex h-full max-h-dvh w-full max-w-[27rem] flex-col border-l border-[#eadfca] bg-[#fffaf0] pb-[env(safe-area-inset-bottom)] shadow-[0_0_80px_rgba(75,55,21,0.18)]">
      <div className="border-b border-[#eadfca] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">
              <Sparkles className="h-4 w-4" /> Casper
            </div>
            <h2 className="mt-1 font-serif text-3xl font-semibold text-[#171a22]">Writing room</h2>
            <p className="mt-1 text-sm leading-6 text-muted">Use the connected engines without leaving the page.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost p-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ProviderStatus compact className="mt-4" />
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-[#eadfca] p-3 sm:p-4">
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
            <button type="button" disabled={busy} onClick={() => actionMutation.mutate('critique')} className={actionClass}>Critique</button>
            <button type="button" disabled={busy} onClick={() => actionMutation.mutate('summary')} className={actionClass}>Summary</button>
          </>
        )}
        {projectId && (
          <>
            <button type="button" disabled={busy} onClick={() => actionMutation.mutate('consistency')} className={actionClass}>Consistency</button>
            <button type="button" disabled={busy} onClick={() => actionMutation.mutate('titles')} className={actionClass}>
              <BookOpen className="mr-1 inline h-3.5 w-3.5 text-[#98711d]" /> Titles
            </button>
            <button type="button" disabled={busy} onClick={() => actionMutation.mutate('plot-suggest')} className={actionClass}>Plot</button>
          </>
        )}
        {selectedText && (
          <button type="button" disabled={busy} onClick={() => actionMutation.mutate('style-lock')} className={actionClass}>Style Lock</button>
        )}
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto p-5">
        {busy && !response && (
          <div className="flex items-center justify-center rounded-[2rem] border border-[#eadfca] bg-white/75 py-12 text-muted shadow-paper">
            <Loader2 className="mr-2 h-6 w-6 animate-spin text-[#98711d]" />
            Casper is thinking...
          </div>
        )}
        {response ? (
          <div className="rounded-[2rem] border border-[#eadfca] bg-[#fffdf8] p-5 shadow-paper">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">Response</div>
            <p className="whitespace-pre-wrap font-serif text-base leading-8 text-[#28241f]">{response}</p>
          </div>
        ) : !busy ? (
          <div className="flex flex-col items-center justify-center rounded-[2rem] border border-[#eadfca] bg-white/75 px-6 py-14 text-center text-muted shadow-paper">
            <MessageSquare className="mb-4 h-10 w-10 text-[#98711d] opacity-70" />
            <p className="font-serif text-2xl font-semibold text-[#171a22]">Ask about the page.</p>
            <p className="mt-2 text-sm leading-6">Draft, continue, reshape, critique, title, plot or clean up the selected passage.</p>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 space-y-3 border-t border-[#eadfca] bg-white/55 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
        {response && onInsert && (
          <button type="button" onClick={() => onInsert(response)} className="btn-secondary w-full text-xs">
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
            placeholder="Ask Casper..."
            className="input flex-1"
            disabled={busy}
          />
          <button type="button" disabled={!prompt.trim() || busy} onClick={() => streamMutation.mutate(prompt)} className="btn-primary px-3">
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
    <button type="button" onClick={toggle} className={cn('btn-secondary', open && 'border-accent text-[#98711d]')}>
      <Sparkles className="h-4 w-4" />
      Casper
    </button>
  );
}
