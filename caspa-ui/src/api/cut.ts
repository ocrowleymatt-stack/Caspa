import { apiCall } from './client';
import { startJobBackedRequest, type JobProgress, type JobStartResponse } from './caspaJobs';

export type CutDepth = 'light' | 'moderate' | 'ruthless';

export interface CutAnalyseRequest {
  unitId?: string;
  targetRuntimeMinutes?: number;
  targetPageCount?: number;
  targetWordCount?: number;
  cutDepth?: CutDepth;
  preserveTone?: boolean;
  preservePlot?: boolean;
  preserveJokes?: boolean;
  preserveSongs?: boolean;
  notes?: string;
}

export interface CutMapCandidate {
  title?: string;
  cutType?: string;
  reason?: string;
  risk?: string;
  estimatedWordsSaved?: number;
}

export interface CutAnalyseResult {
  success: boolean;
  outputId: string;
  currentWordCount: number;
  targetWordCount: number;
  cutNeeded: number;
  cutMap: {
    cutCandidates?: CutMapCandidate[];
    keepList?: string[];
    risks?: string[];
    cutReport?: string;
  };
  cutReport: string;
}

export async function analyseCut(
  projectId: string,
  body: CutAnalyseRequest,
  options?: { onProgress?: (progress: JobProgress) => void },
) {
  return startJobBackedRequest<CutAnalyseResult>(
    () =>
      apiCall<JobStartResponse | CutAnalyseResult>(`/api/projects/${projectId}/cut/analyse`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    {
      onProgress: options?.onProgress,
      extractResult: (job) => job.result as unknown as CutAnalyseResult,
    },
  );
}

export async function generateCutDraft(
  projectId: string,
  body: CutAnalyseRequest & { cutReport?: string; cutMap?: CutAnalyseResult['cutMap'] },
) {
  return apiCall<{
    outputId: string;
    draftText: string;
    wordCount: number;
    targetWordCount: number;
    unitId?: string;
  }>(`/api/projects/${projectId}/cut/generate-draft`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function applyCut(
  projectId: string,
  body: { unitId: string; revisedText: string; outputId?: string },
) {
  return apiCall<{ applied: boolean; unitId: string }>(`/api/projects/${projectId}/cut/apply`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
