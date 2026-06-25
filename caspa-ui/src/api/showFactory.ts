import { apiCall, apiDownload } from './client';
import type { JobStatus, ShowPackage } from '../types';

export async function listShowPackages(projectId: string): Promise<ShowPackage[]> {
  return apiCall<ShowPackage[]>(`/api/show-factory/packages/${projectId}`);
}

export async function generateShowPackage(
  projectId: string,
  type: ShowPackage['type'],
): Promise<{ jobId: string; packageId: string }> {
  return apiCall(`/api/show-factory/generate`, {
    method: 'POST',
    body: JSON.stringify({ projectId, type }),
  });
}

export async function getShowPackage(id: string): Promise<ShowPackage> {
  return apiCall<ShowPackage>(`/api/show-factory/package/${id}`);
}

export async function deleteShowPackage(id: string): Promise<{ id: string }> {
  return apiCall<{ id: string }>(`/api/show-factory/package/${id}`, { method: 'DELETE' });
}

export async function getShowFactoryJobStatus(id: string): Promise<JobStatus> {
  return apiCall<JobStatus>(`/api/show-factory/status/${id}`);
}

export async function downloadShowPackage(id: string, format: 'zip' | 'pdf' = 'zip'): Promise<void> {
  return apiDownload(`/api/show-factory/export/${id}?format=${format}`);
}
