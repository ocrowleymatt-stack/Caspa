import { apiCall } from './client';
import type { PlotPoint } from '../types';

export type PierNextStep =
  | 'survey'
  | 'place-pole'
  | 'lay-boards'
  | 'stretch-decking'
  | 'research'
  | 'revise-boards'
  | 'ready';

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
  poles: Array<{
    id: string;
    title: string;
    description: string;
    order: number;
    type: string;
    chapterId?: string;
    complete: boolean;
  }>;
  gaps: Array<{
    fromPoleId: string;
    toPoleId: string;
    fromTitle: string;
    toTitle: string;
    hasProseCoverage: boolean;
    estimatedNeed: 'structure' | 'prose' | 'research';
  }>;
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

export async function pierSurvey(projectId: string): Promise<PierSurveyResult> {
  return apiCall<PierSurveyResult>('/api/manuscript/pier/survey', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export async function pierPlacePole(
  projectId: string,
  data: {
    poleId?: string;
    title: string;
    description: string;
    type?: PlotPoint['type'];
    order?: number;
    chapterId?: string;
  },
) {
  return apiCall<{ pole: PlotPoint; created: boolean }>('/api/manuscript/pier/place-pole', {
    method: 'POST',
    body: JSON.stringify({ projectId, ...data }),
  });
}

export async function pierLayBoards(
  projectId: string,
  data: { fromPoleId: string; toPoleId: string; tone?: string },
) {
  return apiCall<
    | { refused: false; outputId: string; title: string; text: string; provider: string; model: string }
    | { refused: true; message: string; recommendation: PierNextStep }
  >('/api/manuscript/pier/lay-boards', {
    method: 'POST',
    body: JSON.stringify({ projectId, ...data }),
  });
}

export async function pierStretchDecking(
  projectId: string,
  data: {
    sourceText: string;
    structuralPurpose: string;
    targetExtraWords?: number;
    unitId?: string;
  },
) {
  return apiCall<
    | { refused: false; outputId: string; title: string; text: string; addedWords: number }
    | { refused: true; message: string; recommendation: PierNextStep }
  >('/api/manuscript/pier/stretch-decking', {
    method: 'POST',
    body: JSON.stringify({ projectId, ...data }),
  });
}

export async function pierExtend(projectId: string): Promise<PierExtendResult> {
  return apiCall<PierExtendResult>('/api/manuscript/pier/extend', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export const PIER_STEP_LABELS: Record<PierNextStep, string> = {
  survey: 'Survey manuscript',
  'place-pole': 'Place pole',
  'lay-boards': 'Lay boards',
  'stretch-decking': 'Stretch decking',
  research: 'Research missing depth',
  'revise-boards': 'Revise boards',
  ready: 'Submission-ready span',
};
