/** Gold synthesis — final pass integrating spine modules (Phase 9). */

import type { ProseAssessment } from './awardsShelf';

export type GoldSynthesisStage = 'draft' | 'revision' | 'submission';

export interface GoldStructuralAssessment {
  summary: string;
  unitCount: number;
  poleCoverage: string;
  structureType?: string;
  risks: string[];
}

export interface GoldResearchAssessment {
  confirmedNoteCount: number;
  unverifiedNoteCount: number;
  summary: string;
  gaps: string[];
  accuracyFlags: string[];
}

export interface GoldAntiFillerReport {
  warnings: string[];
  justifiedExpansion: string[];
  summary: string;
}

export interface GoldSynthesisInput {
  projectId: string;
  sourceText?: string;
  workType?: string;
  stage?: GoldSynthesisStage;
  improveText?: boolean;
  swarmOutputId?: string;
  awardAssessmentOutputId?: string;
  includeElevationSteps?: boolean;
}

export interface GoldSynthesisSourcesUsed {
  projectBible: boolean;
  researchLibrary: boolean;
  awardsShelf: boolean;
  agentSwarm: boolean;
  structureModel: boolean;
  awardAssessment: boolean;
}

export interface GoldSynthesisResult {
  projectId: string;
  stage: GoldSynthesisStage;
  workType?: string;
  targetWordCount: number;
  form?: string;
  judgeAssessment: string;
  structuralAssessment: GoldStructuralAssessment;
  proseAssessment: ProseAssessment;
  researchAssessment: GoldResearchAssessment;
  antiFillerReport: GoldAntiFillerReport;
  revisionPlan: string[];
  improvedText?: string;
  sourcesUsed: GoldSynthesisSourcesUsed;
  disclaimer: string;
  swarmOutputId?: string;
  awardAssessmentOutputId?: string;
  createdAt: string;
}

export const GOLD_SYNTHESIS_DISCLAIMER =
  'Gold synthesis integrates prior module outputs — it does not replace Awards Shelf or Agent Swarm assessments.';
