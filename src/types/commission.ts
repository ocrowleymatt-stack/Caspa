/**
 * Caspa Commission Model — structured diagnosis and execution contracts
 */

import type { Chapter } from '../types';

export type CommissionScopeType = 'whole' | 'chapters' | 'single' | 'rebuild' | 'autowrite';

export interface CommissionScope {
  type: CommissionScopeType;
  chapterFrom?: number;
  chapterTo?: number;
  singleChapter?: number;
}

export interface Recommendation {
  id: string;
  title: string;
  detail: string;
  severity: 'critical' | 'major' | 'minor';
  defaultSelected: boolean;
  actionType: 'cut' | 'restructure' | 'rewrite' | 'research' | 'rebuild';
  chapterRefs?: number[];
}

export interface ChapterSummary {
  order: number;
  title: string;
  summary: string;
  wordCount: number;
  needsWork: boolean;
}

export interface Diagnosis {
  verdict: string;
  inputType: 'manuscript' | 'plan' | 'mixed';
  wordCount: number;
  chapterCount: number;
  viabilityScore: number;
  suggestRebuild: boolean;
  recommendations: Recommendation[];
  chapterSummaries: ChapterSummary[];
  editorNotes: string;
}

export type CommissionPhase = 'idle' | 'diagnosing' | 'ready' | 'executing' | 'complete' | 'error';

export interface CommissionProgress {
  phase: string;
  message: string;
  percent: number;
}

export interface CommissionState {
  phase: CommissionPhase;
  rawInput: string;
  chapters: Chapter[];
  diagnosis: Diagnosis | null;
  selectedRecommendationIds: string[];
  scope: CommissionScope;
  progress: CommissionProgress | null;
  artefact: string;
  error: string | null;
}

export const defaultCommissionScope: CommissionScope = { type: 'whole' };

export const defaultCommissionState: CommissionState = {
  phase: 'idle',
  rawInput: '',
  chapters: [],
  diagnosis: null,
  selectedRecommendationIds: [],
  scope: defaultCommissionScope,
  progress: null,
  artefact: '',
  error: null,
};
