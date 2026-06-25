import { apiCall, apiPostStream } from './client';

export function interpretCommand(body: { text: string; projectId?: string }) {
  return apiCall<unknown>('/api/command/interpret', { method: 'POST', body: JSON.stringify(body) });
}

export function planCommand(body: { text: string; projectId?: string }) {
  return apiCall<unknown>('/api/command/plan', { method: 'POST', body: JSON.stringify(body) });
}

export function executeCommand(body: { text?: string; projectId?: string; planId?: string }) {
  return apiCall<unknown>('/api/command/execute', { method: 'POST', body: JSON.stringify(body) });
}

export function listCommandTools(category?: string) {
  const q = category ? `?category=${encodeURIComponent(category)}` : '';
  return apiCall<unknown[]>(`/api/command/tools${q}`);
}

export function listWorkflows(projectId: string) {
  return apiCall<unknown[]>(`/api/command/workflows/${projectId}`);
}

export function streamCommand(
  body: { text: string; projectId?: string },
  onEvent: (data: unknown) => void,
  signal?: AbortSignal,
) {
  return apiPostStream('/api/command/stream', body, onEvent, signal);
}
