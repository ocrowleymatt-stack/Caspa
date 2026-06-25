import { apiCall, apiDownload } from './client';
import type { ExportJob } from '../types';

export async function listExports(projectId?: string): Promise<ExportJob[]> {
  const qs = projectId ? `?projectId=${projectId}` : '';
  return apiCall<ExportJob[]>(`/api/publish/exports${qs}`);
}

export async function getExport(id: string): Promise<ExportJob> {
  return apiCall<ExportJob>(`/api/publish/exports/${id}`);
}

export async function exportPdf(
  projectId: string,
  options: {
    fontSize?: number;
    margin?: number;
    includeTableOfContents?: boolean;
    pageSize?: string;
  },
): Promise<{ jobId: string; exportId: string }> {
  return apiCall('/api/publish/pdf', {
    method: 'POST',
    body: JSON.stringify({ projectId, options }),
  });
}

export async function exportEpub(
  projectId: string,
  options: {
    author?: string;
    publisher?: string;
    language?: string;
    includeCover?: boolean;
  },
): Promise<{ jobId: string; exportId: string }> {
  return apiCall('/api/publish/epub', {
    method: 'POST',
    body: JSON.stringify({ projectId, options }),
  });
}

export async function exportKdp(projectId: string): Promise<{ jobId: string; exportId: string }> {
  return apiCall('/api/publish/kdp', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export async function exportIngram(projectId: string): Promise<{ jobId: string; exportId: string }> {
  return apiCall('/api/publish/ingram', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export async function downloadExport(id: string): Promise<void> {
  return apiDownload(`/api/publish/download/${id}`);
}

export async function validateKdp(projectId: string) {
  return apiCall<{ valid: boolean; issues: string[] }>('/api/publish/validate/kdp', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}
