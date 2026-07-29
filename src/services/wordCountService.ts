/**
 * Word-count helpers and quality-driven cut planning.
 * Cuts are sized by product need (target + quality gates), never a fixed %.
 */

import type { NovelWriteProMode } from './literary/novelWritePro';
import { aggregateQuality, runQualityGates } from './qualityGateService';

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export type SectionWordBudget = {
  bookTarget: number;
  currentWords: number;
  remainingWords: number;
  totalBeats: number;
  remainingBeats: number;
  /** Hard target for this section/chapter. */
  sectionTarget: number;
  minWords: number;
  maxWords: number;
};

/**
 * Split remaining aspire-to length across remaining beats so the manuscript
 * can actually land near the book target (instead of a fixed 1500–2500).
 */
export function sectionWordBudget(opts: {
  targetWordCount: number;
  totalBeats?: number;
  remainingBeats?: number;
  currentWords?: number;
  mode?: string;
}): SectionWordBudget {
  const bookTarget = Math.max(100, Math.round(opts.targetWordCount || 0));
  const currentWords = Math.max(0, Math.round(opts.currentWords || 0));
  const totalBeats = Math.max(1, Math.round(opts.totalBeats || 1));
  const remainingBeats = Math.max(1, Math.round(opts.remainingBeats || totalBeats));
  const remainingWords = Math.max(0, bookTarget - currentWords);

  let sectionTarget = Math.round(remainingWords / remainingBeats);

  // Mode floors / ceilings so short forms and long novels both work.
  const mode = opts.mode || 'novel';
  let floor = 1200;
  let ceiling = 10000;
  if (mode === 'essay') {
    floor = 800;
    ceiling = Math.max(bookTarget, 1200);
  } else if (mode === 'poetry') {
    floor = 40;
    ceiling = 400;
  } else if (mode === 'picture') {
    floor = 80;
    ceiling = 600;
  } else if (mode === 'script' || mode === 'musical') {
    floor = 800;
    ceiling = 5000;
  } else if (mode === 'nonfiction') {
    floor = 1500;
    ceiling = 9000;
  }

  // If we still have a lot of book left, don't under-ask the model.
  if (remainingWords > 0) {
    sectionTarget = Math.max(floor, Math.min(ceiling, sectionTarget || floor));
  } else {
    sectionTarget = Math.min(ceiling, Math.max(Math.round(floor * 0.6), 200));
  }

  // Single-beat short forms: aim at the whole book target.
  if (totalBeats === 1 && (mode === 'essay' || mode === 'poetry' || mode === 'picture')) {
    sectionTarget = Math.max(floor, Math.min(ceiling, bookTarget));
  }

  const minWords = Math.max(Math.round(sectionTarget * 0.9), Math.min(floor, sectionTarget));
  const maxWords = Math.round(sectionTarget * 1.12);

  return {
    bookTarget,
    currentWords,
    remainingWords,
    totalBeats,
    remainingBeats,
    sectionTarget,
    minWords,
    maxWords,
  };
}

export function sectionOutputInstruction(budget: SectionWordBudget, kind: 'chapter' | 'section' | 'scene' = 'chapter'): string {
  return (
    `Full ${kind} for this beat only — HARD TARGET ${budget.sectionTarget.toLocaleString()} words ` +
    `(acceptable ${budget.minWords.toLocaleString()}–${budget.maxWords.toLocaleString()}). ` +
    `Book aspire-to ${budget.bookTarget.toLocaleString()} words; manuscript so far ${budget.currentWords.toLocaleString()}; ` +
    `${budget.remainingBeats} beat(s) remaining including this one. ` +
    `Do not stop early. Do not restart the book or repeat prior ${kind}s.`
  );
}

export function buildExpandSectionPrompt(opts: {
  excerpt: string;
  sectionTarget: number;
  currentSectionWords: number;
  focusBeat?: string;
  mode?: string;
}): string {
  const need = Math.max(0, opts.sectionTarget - opts.currentSectionWords);
  const nonfiction = opts.mode === 'nonfiction' || opts.mode === 'essay';
  return [
    'Continue this draft from where it left off. Do not restart. Do not summarise.',
    opts.focusBeat ? `FOCUS BEAT: ${opts.focusBeat}` : '',
    `You have written ~${opts.currentSectionWords.toLocaleString()} words. Write ~${need.toLocaleString()} more words to reach ~${opts.sectionTarget.toLocaleString()}.`,
    nonfiction
      ? 'Add concrete evidence, turns of argument, and scene/setting specificity — not filler.'
      : 'Deepen scene turns, concrete behaviour, dialogue conflict, and place — not filler or summary.',
    'Return ONLY the continuation prose to append.',
    '',
    'EXISTING SECTION (tail):',
    opts.excerpt.slice(-6000),
  ]
    .filter(Boolean)
    .join('\n');
}

/** Token budget for a section target (words → tokens with headroom). */
export function tokensForWordTarget(sectionTarget: number, json = false): number {
  if (json) return 4096;
  const estimated = Math.round(sectionTarget * 1.6) + 800;
  return Math.max(4096, Math.min(24000, estimated));
}

export function defaultTargetWordCount(mode: string): number {
  switch (mode) {
    case 'essay':
      return 3000;
    case 'poetry':
      return 800;
    case 'picture':
      return 500;
    case 'script':
      return 20000;
    case 'musical':
      return 25000;
    case 'nonfiction':
      return 50000;
    case 'gold':
    case 'polish':
      return 80000;
    case 'adaptation':
    case 'chaos':
    case 'novel':
    default:
      return 80000;
  }
}

export type CutPlan = {
  beforeWords: number;
  targetWords: number | null;
  overTarget: boolean;
  suggestedAfterWords: number;
  /** Soft guide for the model — not a hard quota. */
  suggestedReduction: number;
  needsCut: boolean;
  reasons: string[];
  qualityScore: number;
  cutBrief: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Decide whether / how much to cut based on target length and quality issues.
 * Never defaults to an arbitrary 30–40% trim.
 */
export function planQualityCut(
  content: string,
  opts: { mode?: NovelWriteProMode | string; targetWordCount?: number | null } = {}
): CutPlan {
  const mode = (opts.mode || 'novel') as NovelWriteProMode;
  const beforeWords = countWords(content);
  const targetWords =
    typeof opts.targetWordCount === 'number' && opts.targetWordCount > 0
      ? Math.round(opts.targetWordCount)
      : null;

  const findings = runQualityGates(content, mode);
  const { overallScore } = aggregateQuality(findings);
  const reasons: string[] = [];

  // Too short to cut — length problems need expansion, not a scalpel.
  if (beforeWords < 200 && !(targetWords && beforeWords > Math.round(targetWords * 1.02))) {
    return {
      beforeWords,
      targetWords,
      overTarget: false,
      suggestedAfterWords: beforeWords,
      suggestedReduction: 0,
      needsCut: false,
      reasons: ['Draft is still short — expand before cutting.'],
      qualityScore: overallScore,
      cutBrief:
        mode === 'nonfiction' || mode === 'essay'
          ? 'Draft is short. Do not force cuts. Only remove obvious false profundity if present; otherwise return nearly unchanged.'
          : 'Draft is short. Do not force cuts. Only remove obvious sludge if present; otherwise return nearly unchanged.',
    };
  }

  let suggestedAfterWords = beforeWords;
  let suggestedReduction = 0;
  let overTarget = false;

  if (targetWords && beforeWords > Math.round(targetWords * 1.02)) {
    overTarget = true;
    // Aim just under target so the aspire-to length is real, not decorative.
    const aim = Math.max(40, Math.round(targetWords * 0.98));
    suggestedAfterWords = Math.min(beforeWords, aim);
    suggestedReduction = clamp(1 - suggestedAfterWords / beforeWords, 0.04, 0.45);
    reasons.push(
      `Over target: ${beforeWords.toLocaleString()} words vs aspire-to ${targetWords.toLocaleString()}.`
    );
  }

  // Quality pressure — only add cut when gates actually flag sludge.
  const filler = findings.find((f) => f.gate === 'Filler & hedge words');
  const specificity = findings.find((f) => f.gate === 'Concrete specificity');
  const rhythm = findings.find((f) => f.gate === 'Rhythm & pacing');

  let qualityReduction = 0;
  if (filler && filler.score < 75) {
    const bump = clamp((75 - filler.score) / 200, 0.04, 0.18);
    qualityReduction += bump;
    reasons.push(...(filler.issues.length ? filler.issues : ['Filler / hedge density is high.']));
  }
  if (specificity && specificity.score < 70) {
    qualityReduction += clamp((70 - specificity.score) / 250, 0.03, 0.1);
    reasons.push(...(specificity.issues.length ? specificity.issues : ['Too many abstract emotion labels.']));
  }
  if (rhythm && rhythm.score < 65) {
    qualityReduction += 0.04;
    reasons.push(...(rhythm.issues.length ? rhythm.issues : ['Rhythm needs tightening.']));
  }

  if (!overTarget && qualityReduction > 0) {
    // Already under / near aspire-to: surgical only — never gut a short draft to chase "percentage".
    const underTarget = targetWords ? beforeWords < targetWords * 0.95 : false;
    suggestedReduction = underTarget
      ? clamp(qualityReduction, 0.03, 0.12)
      : clamp(qualityReduction, 0.04, 0.28);
    suggestedAfterWords = Math.max(40, Math.round(beforeWords * (1 - suggestedReduction)));
  } else if (overTarget && qualityReduction > 0) {
    // When both apply, take the stronger lean — still capped.
    suggestedReduction = clamp(Math.max(suggestedReduction, qualityReduction), 0.04, 0.45);
    suggestedAfterWords = Math.max(
      targetWords ? Math.round(targetWords * 0.95) : 40,
      Math.round(beforeWords * (1 - suggestedReduction))
    );
    if (targetWords) {
      suggestedAfterWords = Math.min(suggestedAfterWords, Math.round(targetWords * 0.98));
      suggestedReduction = clamp(1 - suggestedAfterWords / beforeWords, 0.04, 0.45);
    }
  }

  const needsCut = overTarget || qualityReduction >= 0.04 || overallScore < 78;

  if (!needsCut) {
    reasons.push('Draft is near target and quality gates are healthy — only surgical sludge removal.');
    suggestedReduction = 0;
    suggestedAfterWords = beforeWords;
  } else if (!reasons.length) {
    reasons.push('Tighten toward the best product: remove repetition and ornamental explanation.');
  }

  const modeHint =
    mode === 'nonfiction' || mode === 'essay'
      ? 'Prefer claim precision and evidence density over invented drama. Never invent fiction beats.'
      : mode === 'poetry'
        ? 'Prefer compression and image pressure over explanation.'
        : 'Prefer scene turns, concrete behaviour, and voice over decorative abstraction.';

  const cutBrief = needsCut
    ? [
        'Cut only what weakens the product. Do not hit a percentage quota.',
        targetWords
          ? `Aspire-to length: ~${targetWords.toLocaleString()} words (now ${beforeWords.toLocaleString()}). Soft landing near ${suggestedAfterWords.toLocaleString()} words if that improves the work.`
          : `Current length: ${beforeWords.toLocaleString()} words. Soft landing near ${suggestedAfterWords.toLocaleString()} words only if that improves the work.`,
        `Quality score before cut: ${overallScore}/100.`,
        `Priorities: ${reasons.slice(0, 4).join(' ')}`,
        modeHint,
      ].join(' ')
    : [
        'Do a surgical polish only. Remove obvious sludge, repetition, and false profundity.',
        'Do not force a percentage reduction. If the text is already lean, return it nearly unchanged.',
        targetWords ? `Aspire-to length: ~${targetWords.toLocaleString()} words.` : '',
        modeHint,
      ]
        .filter(Boolean)
        .join(' ');

  return {
    beforeWords,
    targetWords,
    overTarget,
    suggestedAfterWords,
    suggestedReduction,
    needsCut,
    reasons,
    qualityScore: overallScore,
    cutBrief,
  };
}
