import { apiCall } from './client';

export function interpretMusicPrompt(prompt: string) {
  return apiCall<unknown>('/api/music-prompt/interpret', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

export function startJamSession(body: { projectId?: string; promptId?: string }) {
  return apiCall<unknown>('/api/music-prompt/jam/start', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getJamSession(id: string) {
  return apiCall<unknown>(`/api/music-prompt/jam/${id}`);
}

export function addJamNote(id: string, note: string) {
  return apiCall<unknown>(`/api/music-prompt/jam/${id}/note`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}
