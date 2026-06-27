import { Loader2, Lock, X } from 'lucide-react';
import { useState } from 'react';
import { createGoldSourceLock } from '../../api/gold';

export type GoldSourceChoice =
  | { type: 'chapter'; chapterId: string; label: string }
  | { type: 'current-manuscript'; label: string }
  | { type: 'workbench'; pastedText: string; label: string };

interface GoldSourceConfirmModalProps {
  open: boolean;
  projectId: string;
  choices: GoldSourceChoice[];
  defaultChoiceIndex?: number;
  onClose: () => void;
  onConfirmed: (sourceLockId: string, preview: { title: string; wordCount: number }) => void;
}

export function GoldSourceConfirmModal({
  open,
  projectId,
  choices,
  defaultChoiceIndex = 0,
  onClose,
  onConfirmed,
}: GoldSourceConfirmModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(defaultChoiceIndex);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || choices.length === 0) return null;

  const selected = choices[selectedIndex] ?? choices[0];

  const confirm = async () => {
    setLoading(true);
    setError(null);
    try {
      let lock;
      if (selected.type === 'chapter') {
        lock = await createGoldSourceLock({
          projectId,
          sourceType: 'chapter',
          chapterId: selected.chapterId,
          mode: 'improve-same-story',
        });
      } else if (selected.type === 'workbench') {
        lock = await createGoldSourceLock({
          projectId,
          sourceType: 'pasted-text',
          pastedText: selected.pastedText,
          mode: 'improve-same-story',
        });
      } else {
        lock = await createGoldSourceLock({
          projectId,
          sourceType: 'current-manuscript',
          mode: 'improve-same-story',
        });
      }
      onConfirmed(lock.sourceLockId, {
        title: lock.title,
        wordCount: lock.wordCount,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not lock source');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[#0B0F19]/60 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-slate-800/60 bg-[#161B22] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-500">
              <Lock className="h-4 w-4" />
              <span className="text-xs font-mono uppercase tracking-wider">Confirm source</span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-slate-100">Lock manuscript before Gold Pass</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Gold Pass will improve the same story only. Confirm which text is sacred so drift can be detected.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-800 p-2 text-slate-500 hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {choices.map((choice, index) => (
            <button
              key={`${choice.type}-${index}`}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                selectedIndex === index
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-100'
                  : 'border-slate-800 bg-[#0B0F19] text-slate-400 hover:border-slate-700'
              }`}
            >
              <p className="text-sm font-medium">{choice.label}</p>
              <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                {choice.type === 'workbench' ? 'Workbench source' : choice.type.replace('-', ' ')}
              </p>
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-rose-900/50 bg-rose-950/20 px-3 py-2 text-xs text-rose-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-800 px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-[#0B0F19] hover:bg-amber-400 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Confirm source &amp; run
          </button>
        </div>
      </div>
    </div>
  );
}
