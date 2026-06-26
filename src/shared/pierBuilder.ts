/** Pier Builder — plot-led manuscript development loop (Phase 5). */

export type PierNextStep =
  | 'survey'
  | 'place-pole'
  | 'lay-boards'
  | 'stretch-decking'
  | 'research'
  | 'revise-boards'
  | 'ready';

export interface PierPoleSummary {
  id: string;
  title: string;
  description: string;
  order: number;
  type: string;
  chapterId?: string;
  complete: boolean;
}

export interface PierGap {
  fromPoleId: string;
  toPoleId: string;
  fromTitle: string;
  toTitle: string;
  hasProseCoverage: boolean;
  estimatedNeed: 'structure' | 'prose' | 'research';
}

export interface PierSurveyResult {
  projectId: string;
  workType?: string;
  structureType?: string;
  workflowStage?: string;
  wordCount: number;
  targetWordCount: number;
  progressPercent: number;
  poleCount: number;
  structureUnitCount: number;
  poles: PierPoleSummary[];
  gaps: PierGap[];
  warnings: string[];
  recommendedNextStep: PierNextStep;
  recommendationReason: string;
}

export interface PierExtendResult {
  projectId: string;
  recommendedNextStep: PierNextStep;
  recommendationReason: string;
  survey: PierSurveyResult;
}

export const PIER_FILLER_REFUSAL =
  'This would become filler. Place a new structural pole first.';

const STRUCTURAL_PURPOSE_KEYWORDS = [
  'conflict',
  'turn',
  'reveal',
  'foreshadow',
  'escalat',
  'character',
  'pressure',
  'stakes',
  'pacing',
  'payoff',
  'setup',
  'consequence',
  'relationship',
  'tension',
  'shift',
  'decision',
  'reversal',
  'climax',
  'arc',
  'beat',
  'structure',
  'plot',
  'midpoint',
  'crisis',
  'antagonist',
  'wound',
  'choice',
];

export function hasStructuralPurpose(purpose: string): boolean {
  const normalized = purpose.trim().toLowerCase();
  if (normalized.length < 16) return false;
  return STRUCTURAL_PURPOSE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
