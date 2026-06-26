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
  report: GoldReport;
}

export async function runGoldPass(projectId: string, source?: string) {
  return apiCall<GoldPassResult>('/api/gold/run', {
    method: 'POST',
    body: JSON.stringify({ projectId, source }),
  });
}
