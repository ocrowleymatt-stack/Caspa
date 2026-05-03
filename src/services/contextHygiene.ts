import { Chapter } from '../types';

export type ContextHygieneReport = {
  originalChars: number;
  cleanedChars: number;
  duplicateBlockCount: number;
  repeatedOpeningCount: number;
  repeatedPhraseCount: number;
  warnings: string[];
};

export type ContextHygieneResult = {
  cleanedText: string;
  report: ContextHygieneReport;
};

function normaliseBlock(block: string): string {
  return block
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 '.,;:!?-]/g, '')
    .trim();
}

export function dedupeLargeBlocks(text = '', minBlockChars = 1800): ContextHygieneResult {
  const originalChars = text.length;
  const blocks = text.split(/\n{2,}/);
  const seen = new Set<string>();
  const kept: string[] = [];
  let duplicateBlockCount = 0;

  for (const block of blocks) {
    const key = block.length >= minBlockChars ? normaliseBlock(block).slice(0, 4000) : '';
    if (key && seen.has(key)) {
      duplicateBlockCount += 1;
      continue;
    }
    if (key) seen.add(key);
    kept.push(block);
  }

  const cleanedText = kept.join('\n\n').trim();
  const warnings: string[] = [];
  if (duplicateBlockCount > 0) warnings.push(`${duplicateBlockCount} repeated large block(s) removed before generation.`);

  return {
    cleanedText,
    report: {
      originalChars,
      cleanedChars: cleanedText.length,
      duplicateBlockCount,
      repeatedOpeningCount: 0,
      repeatedPhraseCount: 0,
      warnings
    }
  };
}

export function buildCleanContinuityContext(chapters: Chapter[] = [], maxFullChapters = 3): string {
  const ordered = chapters.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const recent = ordered.slice(-maxFullChapters);
  const older = ordered.slice(0, Math.max(0, ordered.length - maxFullChapters));

  const olderDigest = older.map(ch => `# ${ch.title}\nSummary: ${ch.summary || '[no summary]'}\nKey sample: ${(ch.content || '').slice(0, 700)}`).join('\n\n');
  const recentFull = recent.map(ch => `# ${ch.title}\n${ch.summary ? `Summary: ${ch.summary}\n` : ''}${(ch.content || '').slice(0, 9000)}`).join('\n\n---\n\n');

  return dedupeLargeBlocks(`${olderDigest}\n\n${recentFull}`.trim()).cleanedText.slice(-32000);
}

export function repetitionPenaltyReport(text = '', previousChapters: Chapter[] = []) {
  const warnings: string[] = [];
  const lower = text.toLowerCase();
  const openings = previousChapters
    .map(ch => (ch.content || ch.summary || '').split('\n').map(l => l.trim()).find(Boolean) || '')
    .filter(Boolean)
    .map(line => line.toLowerCase().split(/\s+/).slice(0, 5).join(' '));

  const draftOpening = text.split('\n').map(l => l.trim()).find(Boolean)?.toLowerCase().split(/\s+/).slice(0, 5).join(' ') || '';
  const repeatedOpeningCount = draftOpening && openings.includes(draftOpening) ? 1 : 0;
  if (repeatedOpeningCount) warnings.push('Draft repeats a recent opening pattern.');

  const phrases = lower.match(/\b[a-z][a-z'-]+\s+[a-z][a-z'-]+\s+[a-z][a-z'-]+\s+[a-z][a-z'-]+\b/g) || [];
  const counts = new Map<string, number>();
  phrases.forEach(p => counts.set(p, (counts.get(p) || 0) + 1));
  const repeatedPhraseCount = [...counts.values()].filter(c => c >= 4).length;
  if (repeatedPhraseCount) warnings.push(`${repeatedPhraseCount} repeated four-word phrase pattern(s) detected.`);

  const duplicateBlocks = dedupeLargeBlocks(text).report.duplicateBlockCount;
  if (duplicateBlocks) warnings.push(`${duplicateBlocks} duplicate large block(s) detected inside draft.`);

  const penalty = Math.min(35, duplicateBlocks * 12 + repeatedOpeningCount * 8 + repeatedPhraseCount * 2);

  return {
    penalty,
    duplicateBlocks,
    repeatedOpeningCount,
    repeatedPhraseCount,
    warnings
  };
}

export function applyScorePenalties<T extends { overall: number; prose: number; structure: number; originality: number; verdict: 'pass' | 'revise' | 'rewrite'; reasons: string[]; requiredFixes: string[] }>(score: T, penaltyReport: ReturnType<typeof repetitionPenaltyReport>): T {
  if (!penaltyReport.penalty) return score;
  const next = { ...score };
  next.overall = Math.max(0, next.overall - penaltyReport.penalty);
  next.prose = Math.max(0, next.prose - Math.ceil(penaltyReport.penalty * 0.8));
  next.structure = Math.max(0, next.structure - Math.ceil(penaltyReport.penalty * 0.5));
  next.originality = Math.max(0, next.originality - penaltyReport.penalty);
  next.reasons = [...next.reasons, ...penaltyReport.warnings].slice(0, 12);
  next.requiredFixes = [
    ...next.requiredFixes,
    'Remove repeated blocks, repeated openings, recycled phrases and motif loops before accepting this chapter.'
  ].slice(0, 12);
  next.verdict = next.overall < 68 ? 'rewrite' : next.overall < 82 ? 'revise' : next.verdict;
  return next;
}
