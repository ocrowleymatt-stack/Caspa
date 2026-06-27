import type { ImportConfidence } from '../manuscript/ImportAnalyser';
import type { DetectedUnitType } from '../manuscript/ImportAnalyser';
import type { WorkType } from '../../shared/workModel';

export interface ManuscriptStructureUnit {
  id: string;
  order: number;
  type: DetectedUnitType;
  title: string;
  startOffset: number;
  endOffset: number;
  wordCount: number;
  summary?: string;
  sourceRole: 'original';
  needsReview: boolean;
}

export interface ManuscriptStructureReport {
  projectId?: string;
  sourceId?: string;
  detectedType: WorkType;
  confidence: ImportConfidence;
  totalWords: number;
  units: ManuscriptStructureUnit[];
  warnings: string[];
  suggestedNextSteps: string[];
  recommendedImportMode?: string;
  structureType?: string;
}

export interface BookMapChapterEntry {
  unitId?: string;
  order: number;
  title: string;
  summary: string;
  wordCount: number;
  status: 'draft' | 'outline' | 'complete' | 'missing' | 'weak';
}

export interface BookMap {
  projectId: string;
  workingTitle: string;
  projectType: string;
  genre: string;
  premise: string;
  totalWords: number;
  targetWordCount: number;
  completionPercentage: number;
  chapters: BookMapChapterEntry[];
  arcSummary: string;
  characterArcs: string[];
  unresolvedThreads: string[];
  duplicatedMaterial: string[];
  weakSections: string[];
  missingSections: string[];
  continuityWarnings: string[];
  nextRecommendedChapter: string;
  finishRoadmap: string[];
  updatedAt: string;
  generatedFromOutputId?: string;
}

export interface MissingChapterSuggestion {
  title: string;
  purpose: string;
  estimatedWords: number;
  priority: 'high' | 'medium' | 'low';
}

export interface BookCompletionPlan {
  projectId: string;
  missingChapters: MissingChapterSuggestion[];
  nextBestChapter: MissingChapterSuggestion | null;
  finishRoadmap: string[];
  outputId: string;
}

export type FinishBookMode =
  | 'diagnose'
  | 'plan'
  | 'write-next-chapter'
  | 'fill-gap'
  | 'finish-roadmap';

export interface ProjectMemory {
  projectId: string;
  preferredStyle: string;
  bannedCliches: string[];
  voiceSamples: string[];
  characterFacts: string[];
  unresolvedPlotThreads: string[];
  continuityFacts: string[];
  userCorrections: string[];
  neverAgainRules: string[];
  alwaysWriteRules: string[];
  priorGoldCriticisms: string[];
  priorSwarmConsensus: string[];
  updatedAt: string;
}

export interface ProjectSnapshot {
  id: string;
  projectId: string;
  label: string;
  reason: string;
  chapterSnapshots: Array<{ chapterId: string; title: string; content: string; wordCount: number }>;
  createdAt: string;
}
