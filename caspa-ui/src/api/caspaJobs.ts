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
  partialResult?: unknown;
}

export interface CaspaJob {
  id: string;
  projectId?: string;
  type: string;
  status: CaspaJobStatus;
  currentStage?: string;
  stages: CaspaJobStage[];
  error?: string;
  result?: Record<string, unknown>;
  partialResult?: unknown;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface JobStartResponse {
  jobId: string;
  status: string;
  progressUrl: string;
  resumeUrl: string;
  streamUrl?: string;
  message: string;
}

export interface JobProgress {
  jobId: string;
  status: CaspaJobStatus | string;
  progress: number;
  currentStage?: string;
  stages?: CaspaJobStage[];
  partialResult?: unknown;
  result?: unknown;
  error?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function listCaspaJobs(projectId?: string) {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}&system=caspa` : '?system=caspa';
  return apiCall<CaspaJob[]>(`/api/jobs${qs}`);
}

export async function getCaspaJob(jobId: string) {
  return apiCall<CaspaJob>(`/api/jobs/${jobId}`);
}

export async function getJobProgress(jobId: string) {
  return apiCall<JobProgress>(`/api/jobs/${jobId}/progress`);
}

export async function getLatestProjectJob(projectId: string) {
  return apiCall<CaspaJob | null>(`/api/projects/${projectId}/jobs/latest`);
}

export async function cancelCaspaJob(jobId: string) {
  return apiCall<CaspaJob>(`/api/jobs/${jobId}/cancel`, { method: 'POST', body: '{}' });
}

export async function retryCaspaJob(jobId: string) {
  return apiCall<JobStartResponse>(`/api/jobs/${jobId}/retry`, { method: 'POST', body: '{}' });
}

export async function resumeCaspaJob(jobId: string) {
  return apiCall<CaspaJob | JobStartResponse>(`/api/jobs/${jobId}/resume`, { method: 'POST', body: '{}' });
}

export async function waitForCaspaJob(
  jobId: string,
  options?: {
    onProgress?: (progress: JobProgress) => void;
    pollMs?: number;
    timeoutMs?: number;
  },
): Promise<CaspaJob> {
  const pollMs = options?.pollMs ?? 2000;
  const timeoutMs = options?.timeoutMs ?? 30 * 60 * 1000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const progress = await getJobProgress(jobId);
    options?.onProgress?.(progress);

    if (progress.status === 'completed') {
      return getCaspaJob(jobId);
    }
    if (progress.status === 'failed' || progress.status === 'cancelled') {
      throw new Error(progress.error ?? `Job ${progress.status}`);
    }

    await sleep(pollMs);
  }

  throw new Error('Job timed out while waiting for completion — check progress and retry.');
}

export function isJobStartResponse(value: unknown): value is JobStartResponse {
  return Boolean(value && typeof value === 'object' && 'jobId' in value && 'progressUrl' in value);
}

export async function startJobBackedRequest<T>(
  startCall: () => Promise<JobStartResponse | T>,
  options?: {
    onProgress?: (progress: JobProgress) => void;
    onJobStarted?: (jobId: string) => void;
    extractResult?: (job: CaspaJob) => T;
  },
): Promise<T> {
  const start = await startCall();
  if (!isJobStartResponse(start)) {
    return start;
  }
  options?.onJobStarted?.(start.jobId);
  const job = await waitForCaspaJob(start.jobId, { onProgress: options?.onProgress });
  if (options?.extractResult) {
    return options.extractResult(job);
  }
  return (job.result ?? job) as T;
}
