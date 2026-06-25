import { apiCall } from './client';

export function listOutputs(projectId?: string, type?: string) {
  const params = new URLSearchParams();
  if (projectId) params.set('projectId', projectId);
  if (type) params.set('type', type);
  const q = params.toString() ? `?${params}` : '';
  return apiCall<unknown[]>(`/api/outputs${q}`);
}

export function getOutput(id: string) {
  return apiCall<unknown>(`/api/outputs/${id}`);
}

export function registerOutput(body: {
  projectId?: string;
  type: string;
  title: string;
  path?: string;
  metadata?: Record<string, unknown>;
}) {
  return apiCall<unknown>('/api/outputs', { method: 'POST', body: JSON.stringify(body) });
}
