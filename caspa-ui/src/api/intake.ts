import { apiCall } from './client';

export function analyseIntake(body: { content: string; projectId?: string; filename?: string }) {
  return apiCall<unknown>('/api/intake/analyse', { method: 'POST', body: JSON.stringify(body) });
}

export function listIntakeSources(projectId?: string) {
  const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return apiCall<unknown[]>(`/api/intake/sources${q}`);
}

export function getIntakeSource(id: string) {
  return apiCall<unknown>(`/api/intake/sources/${id}`);
}
