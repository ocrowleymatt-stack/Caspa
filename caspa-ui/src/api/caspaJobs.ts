import { apiCall } from './client';

export type CaspaJobStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'partial'
  | 'needs-review';

export interface CaspaJobStage {
  id: string;
  label: string;
  status: CaspaJobStatus;
  startedAt?: string;
  completedAt?: string;
}

export interface CaspaJob {
  id: string;
  projectId?: string;
  type: string;
  status: CaspaJobStatus;
  currentStage?: string;
  stages: CaspaJobStage[];
  error?: string;
  result?: unknown;
  partialResult?: unknown;
  createdAt: string;
  updatedAt: string;
}

export async function listCaspaJobs(projectId?: string) {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return apiCall<CaspaJob[]>(`/api/jobs${qs}`);
}

export async function getCaspaJob(jobId: string) {
  return apiCall<CaspaJob>(`/api/jobs/${jobId}`);
}

export async function getLatestProjectJob(projectId: string) {
  return apiCall<CaspaJob | null>(`/api/projects/${projectId}/jobs/latest`);
}

export async function resumeCaspaJob(jobId: string) {
  return apiCall<CaspaJob>(`/api/jobs/${jobId}/resume`, { method: 'POST' });
}
