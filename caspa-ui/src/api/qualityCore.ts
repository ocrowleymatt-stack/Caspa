import { apiCall } from './client';

export function aiSmellCheck(body: { text?: string; projectId?: string }) {
  return apiCall<unknown>('/api/quality/ai-smell', { method: 'POST', body: JSON.stringify(body) });
}

export function humanVoiceCheck(body: { text?: string; projectId?: string }) {
  return apiCall<unknown>('/api/quality/human-voice', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function consolidatedGate(projectId: string) {
  return apiCall<unknown>(`/api/quality/consolidated-gate/${projectId}`, { method: 'POST' });
}
