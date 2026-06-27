import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Scissors, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { applyManuscriptOutput } from '../api/book';
import { analyseCut, applyCut, generateCutDraft, type CutDepth } from '../api/cut';
import { useToast } from './Toast';

interface CutTightenPanelProps {
  projectId: string;
  unitId?: string;
  unitTitle?: string;
  currentWordCount?: number;
  compact?: boolean;
}

const DEPTH_OPTIONS: Array<{ id: CutDepth; label: string; hint: string }> = [
  { id: 'light', label: 'Light trim', hint: 'Tighten without losing voice' },
  { id: 'moderate', label: 'Moderate', hint: 'Remove repetition and bloat' },
  { id: 'ruthless', label: 'Ruthless map', hint: 'Aggressive cut candidates only — never auto-applied' },
];

export function CutTightenPanel({
  projectId,
  unitId,
  unitTitle,
  currentWordCount,
  compact = false,
}: CutTightenPanelProps) {
  const toast = useToast();
  const [depth, setDepth] = useState<CutDepth>('moderate');
  const [targetWords, setTargetWords] = useState('');
  const [draftText, setDraftText] = useState('');
  const [draftOutputId, setDraftOutputId] = useState<string | null>(null);

  const analyseMutation = useMutation({
    mutationFn: () =>
      analyseCut(projectId, {
        unitId,
        cutDepth: depth,
        targetWordCount: targetWords.trim() ? Number(targetWords) : undefined,
        preservePlot: true,
        preserveTone: true,
      }),
    onSuccess: (result) => {
      setDraftText('');
      setDraftOutputId(null);
      toast.success(`Cut map saved · ${result.cutNeeded.toLocaleString()} words flagged`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const draftMutation = useMutation({
    mutationFn: () => {
      const report = analyseMutation.data;
      if (!report) throw new Error('Generate a cut map first.');
      return generateCutDraft(projectId, {
        unitId,
        cutDepth: depth,
        targetWordCount: targetWords.trim() ? Number(targetWords) : report.targetWordCount,
        cutReport: report.cutReport,
        cutMap: report.cutMap,
      });
    },
    onSuccess: (result) => {
      setDraftText(result.draftText);
      setDraftOutputId(result.outputId);
      toast.success(`Cut draft ready · ${result.wordCount.toLocaleString()} words`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!unitId) throw new Error('Select a chapter scope to apply cuts.');
      if (!draftText.trim()) throw new Error('Generate a cut draft before applying.');
      return applyCut(projectId, {
        unitId,
        revisedText: draftText,
        outputId: draftOutputId ?? undefined,
      });
    },
    onSuccess: () => toast.success('Cut applied safely · snapshot created · original preserved in history'),
    onError: (err: Error) => toast.error(err.message),
  });

  const keepAlternativeMutation = useMutation({
    mutationFn: async () => {
      if (!draftOutputId) throw new Error('Generate a cut draft first.');
      return applyManuscriptOutput(projectId, {
        outputId: draftOutputId,
        mode: 'new-unit',
        newUnitTitle: unitTitle ? `Cut alternative — ${unitTitle}` : 'Cut alternative draft',
        confirmed: true,
      });
    },
    onSuccess: (result) => toast.success(`Saved as new unit · ${result.unitId.slice(0, 8)}`),
    onError: (err: Error) => toast.error(err.message),
  });

  const report = analyseMutation.data;
  const busy = analyseMutation.isPending || draftMutation.isPending || applyMutation.isPending;

  function handleApplyCut() {
    const confirmed = confirm(
      'Apply this tightened draft to the chapter? A project snapshot will be created first. Original text stays in chapter history.',
    );
    if (confirmed) applyMutation.mutate();
  }

  return (
    <div className={`rounded-[1.5rem] border border-[#eadfca] bg-[#fffdf8] p-4 ${compact ? '' : 'shadow-paper'}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">
        <Scissors className="h-4 w-4" /> Cut / Tighten
      </div>
      <p className="mt-2 text-sm leading-6 text-[#5f5648]">
        Analyse bloat, preview a tightened draft, then apply only after confirmation.
      </p>
      {unitTitle ? (
        <p className="mt-2 text-xs font-mono text-[#8a7a62]">
          Scope: {unitTitle}
          {currentWordCount ? ` · ~${currentWordCount.toLocaleString()} words` : ''}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {DEPTH_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setDepth(option.id)}
            className={`rounded-xl border px-3 py-2 text-left transition ${
              depth === option.id
                ? 'border-[#caa044] bg-[#fff8e8] text-[#171a22]'
                : 'border-[#eadfca] bg-white text-[#5f5648] hover:border-[#caa044]'
            }`}
          >
            <p className="text-xs font-bold">{option.label}</p>
            <p className="mt-1 text-[10px] leading-4 text-[#8a7a62]">{option.hint}</p>
          </button>
        ))}
      </div>

      <label className="mt-4 block text-sm text-[#3d352b]">
        <span className="label">Target word count (optional)</span>
        <input
          value={targetWords}
          onChange={(event) => setTargetWords(event.target.value.replace(/[^\d]/g, ''))}
          className="input mt-1"
          placeholder={currentWordCount ? String(Math.round(currentWordCount * 0.9)) : '90000'}
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => analyseMutation.mutate()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-[1.35rem] border border-[#caa044] bg-[#fff8e8] px-5 py-3 text-sm font-bold text-[#171a22] transition hover:bg-[#ffe39a] disabled:opacity-60"
        >
          {analyseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
          Generate cut map
        </button>
        <button
          type="button"
          onClick={() => draftMutation.mutate()}
          disabled={busy || !report}
          className="inline-flex items-center gap-2 rounded-[1.35rem] border border-[#eadfca] bg-white px-5 py-3 text-sm font-bold text-[#171a22] transition hover:border-[#caa044] disabled:opacity-60"
        >
          {draftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Generate tightened draft
        </button>
      </div>

      {report ? (
        <div className="mt-4 space-y-3 rounded-xl border border-[#eadfca] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#5f5648]">
            <span>Current {report.currentWordCount.toLocaleString()} → target {report.targetWordCount.toLocaleString()}</span>
            <span className="text-[#98711d]">Cut needed ~{report.cutNeeded.toLocaleString()} words</span>
          </div>
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-[#3d352b]">
            {report.cutReport}
          </pre>
          <Link
            to={`/outputs/${report.outputId}`}
            className="inline-flex text-xs font-bold uppercase tracking-[0.14em] text-[#98711d] hover:underline"
          >
            Open cut map in Writing History →
          </Link>
        </div>
      ) : null}

      {draftText ? (
        <div className="mt-4 space-y-3 rounded-xl border border-[#caa044] bg-[#fff8e8] p-4">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#98711d]">Preview tightened draft</div>
          <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap font-serif text-sm leading-7 text-[#3d352b]">
            {draftText}
          </pre>
          <div className="flex flex-wrap gap-2">
            {unitId ? (
              <button
                type="button"
                onClick={handleApplyCut}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-[1.2rem] bg-[#171a22] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {applyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Apply safely to chapter
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => keepAlternativeMutation.mutate()}
              disabled={busy || !draftOutputId}
              className="inline-flex items-center gap-2 rounded-[1.2rem] border border-[#caa044] bg-white px-4 py-2 text-xs font-bold text-[#171a22] disabled:opacity-60"
            >
              Keep as new unit
            </button>
            {draftOutputId ? (
              <Link to={`/outputs/${draftOutputId}`} className="inline-flex items-center px-2 py-2 text-xs font-bold text-[#98711d] hover:underline">
                Open draft output
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
