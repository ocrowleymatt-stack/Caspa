import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Scissors } from 'lucide-react';
import { Link } from 'react-router-dom';
import { analyseCut, type CutDepth } from '../api/cut';
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
      toast.success(`Cut map saved · ${result.cutNeeded.toLocaleString()} words flagged`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const report = analyseMutation.data;

  return (
    <div className={`rounded-[1.5rem] border border-[#eadfca] bg-[#fffdf8] p-4 ${compact ? '' : 'shadow-paper'}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">
        <Scissors className="h-4 w-4" /> Cut / Tighten
      </div>
      <p className="mt-2 text-sm leading-6 text-[#5f5648]">
        Analyse bloat and dead time without applying cuts silently. Original text stays sacred; apply only after review.
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

      <button
        type="button"
        onClick={() => analyseMutation.mutate()}
        disabled={analyseMutation.isPending}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-[1.35rem] border border-[#caa044] bg-[#fff8e8] px-5 py-3 text-sm font-bold text-[#171a22] transition hover:bg-[#ffe39a] disabled:opacity-60 md:w-auto"
      >
        {analyseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
        {analyseMutation.isPending ? 'Analysing cuts…' : 'Generate cut map'}
      </button>

      {report ? (
        <div className="mt-4 space-y-3 rounded-xl border border-[#eadfca] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#5f5648]">
            <span>Current {report.currentWordCount.toLocaleString()} → target {report.targetWordCount.toLocaleString()}</span>
            <span className="text-[#98711d]">Cut needed ~{report.cutNeeded.toLocaleString()} words</span>
          </div>
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-[#3d352b]">
            {report.cutReport}
          </pre>
          {report.cutMap.cutCandidates?.length ? (
            <ul className="space-y-2 text-xs text-[#5f5648]">
              {report.cutMap.cutCandidates.slice(0, 5).map((candidate, index) => (
                <li key={`${candidate.title ?? 'cut'}-${index}`} className="rounded-lg bg-[#fff8e8] px-3 py-2">
                  <strong>{candidate.title ?? 'Candidate'}</strong>
                  {candidate.reason ? ` — ${candidate.reason}` : ''}
                  {candidate.risk ? ` · Risk: ${candidate.risk}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
          <Link
            to={`/outputs/${report.outputId}`}
            className="inline-flex text-xs font-bold uppercase tracking-[0.14em] text-[#98711d] hover:underline"
          >
            Open cut map in Writing History →
          </Link>
        </div>
      ) : null}
    </div>
  );
}