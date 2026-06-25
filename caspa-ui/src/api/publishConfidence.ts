import { apiCall } from './client';

export function checkPublishConfidence(projectId: string) {
  return apiCall<unknown>('/api/publish-confidence/check', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export function listConfidenceCertificates(projectId?: string) {
  const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return apiCall<unknown[]>(`/api/publish-confidence/certificates${q}`);
}
