import { apiCall } from './client';
import type { GoldReport } from '../types';

export type GoldPassDepth = 'surface' | 'structural' | 'deep';
export type GoldModelRoute = 'local' | 'hybrid' | 'cloud' | 'manual';
export type GoldRunMode = 'suggestion' | 'controlled' | 'full';

export interface GoldRunOptions {
  depth?: GoldPassDepth;
  biases?: string[];
  route?: GoldModelRoute;
  runMode?: GoldRunMode;
  chapterIds?: string[];
}

export async function runGoldPipeline(projectId: string, options?: GoldRunOptions) {
  return apiCall<GoldReport>(`/api/gold/run/${projectId}`, {
    method: 'POST',
    body: options ? JSON.stringify(options) : undefined,
  });
}

export async function getGoldReport(projectId: string) {
  return apiCall<GoldReport | null>(`/api/gold/report/${projectId}`);
}

export interface GoldPassResult {
  jobId: string;
  status: string;
  outputId: string;
  improved: string;
  critique: string;
  report?: GoldReport;
  synthesis?: {
    judgeAssessment: string;
    structuralAssessment: { summary: string; risks: string[] };
    proseAssessment: Record<string, number>;
    researchAssessment: { summary: string; gaps: string[] };
    antiFillerReport: { warnings: string[]; summary: string };
    revisionPlan: string[];
    sourcesUsed: Record<string, boolean>;
    disclaimer: string;
    improvedText?: string;
  };
}

export async function createGoldSourceLock(body: {
  projectId: string;
  sourceType?: string;
  chapterId?: string;
  unitId?: string;
  outputId?: string;
  pastedText?: string;
  mode?: string;
}) {
  return apiCall<{
    sourceLockId: string;
    title: string;
    wordCount: number;
    sourcePreviewStart: string;
    sourcePreviewEnd: string;
    mode: string;
  }>('/api/gold/source-lock', { method: 'POST', body: JSON.stringify(body) });
}

export async function runGoldPass(
  projectId: string,
  source?: string,
  options?: {
    sourceLockId?: string;
    improveText?: boolean;
    stage?: 'draft' | 'revision' | 'submission';
    swarmOutputId?: string;
    awardAssessmentOutputId?: string;
    includeElevationSteps?: boolean;
    mode?: string;
  },
) {
  return apiCall<GoldPassResult>('/api/gold/run', {
    method: 'POST',
    body: JSON.stringify({ projectId, source, ...options }),
  });
}
