import { apiCall, apiStream } from './client';
import type { JobStatus, QueueStats } from '../types';

export async function listJobs(filters?: {
  type?: string;
  status?: string;
}): Promise<JobStatus[]> {
  const params = new URLSearchParams();
  if (filters?.type) params.set('type', filters.type);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return apiCall<JobStatus[]>(`/api/jobs${qs ? `?${qs}` : ''}`);
}

export async function getJob(id: string): Promise<JobStatus> {
  return apiCall<JobStatus>(`/api/jobs/${id}`);
}

export async function cancelJob(id: string): Promise<{ cancelled: string }> {
  return apiCall<{ cancelled: string }>(`/api/jobs/${id}`, { method: 'DELETE' });
}

export async function getQueueStats(): Promise<QueueStats> {
  return apiCall<QueueStats>('/api/jobs/stats');
}

export async function clearCompletedJobs(): Promise<{ cleared: boolean }> {
  return apiCall<{ cleared: boolean }>('/api/jobs/clear/completed', { method: 'DELETE' });
}

export function subscribeToJobs(
  onUpdate: (job: JobStatus) => void,
): EventSource {
  const source = apiStream('/api/jobs/stream');

  source.addEventListener('job-update', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as JobStatus;
      onUpdate(data);
    } catch {
      // ignore parse errors
    }
  });

  return source;
}

export function subscribeToJob(
  jobId: string,
  onUpdate: (job: Partial<JobStatus>) => void,
): EventSource {
  const source = apiStream(`/api/jobs/${jobId}/stream`);

  source.addEventListener('job-update', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as Partial<JobStatus>;
      onUpdate(data);
    } catch {
      // ignore parse errors
    }
  });

  return source;
}
