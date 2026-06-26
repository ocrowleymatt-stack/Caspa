import { apiCall, apiPostStream } from './client';

export function casperFreestyle(body: { input?: string; sessionId?: string; projectId?: string }) {
  return apiCall<unknown>('/api/casper/freestyle', { method: 'POST', body: JSON.stringify(body) });
}

export function casperStream(
  body: { input: string; sessionId?: string; projectId?: string },
  onEvent: (data: unknown) => void,
  signal?: AbortSignal,
) {
  return apiPostStream('/api/casper/freestyle/stream', body, onEvent, signal);
}

export function listCasperSessions() {
  return apiCall<unknown[]>('/api/casper/sessions');
}

export function getCasperSession(id: string) {
  return apiCall<unknown>(`/api/casper/session/${id}`);
}

export function continueCasperSession(id: string, input: string) {
  return apiCall<unknown>(`/api/casper/session/${id}/continue`, {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

export function getCasperStatus() {
  return apiCall<{ available: boolean; version: string; message: string }>('/api/casper/status');
}

export interface NovelWriteProResult {
  outputId: string;
  projectId?: string;
  title: string;
  kind: 'novel-write-pro';
  text: string;
  provider: string;
  model: string;
  createdAt: string;
}

export function runNovelWritePro(body: {
  projectId?: string;
  mode?: string;
  output?: string;
  spark?: string;
  source?: string;
  tone?: string;
  uploadedName?: string | null;
  modeTitle?: string;
  genre?: string;
}) {
  return apiCall<NovelWriteProResult>('/api/casper/novel-write-pro', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
