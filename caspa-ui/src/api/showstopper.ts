import { apiCall } from './client';

export async function findShowstopper(projectId: string) {
  return apiCall(`/api/showstopper/find/${projectId}`, { method: 'POST' });
}

export async function killerLines(text: string, projectId?: string) {
  return apiCall('/api/showstopper/killer-lines', { method: 'POST', body: JSON.stringify({ text, projectId }) });
}

export async function bigNumber(projectId: string) {
  return apiCall(`/api/showstopper/big-number/${projectId}`, { method: 'POST' });
}

export async function finale(projectId: string) {
  return apiCall(`/api/showstopper/finale/${projectId}`, { method: 'POST' });
}

export async function trailerMoments(projectId: string) {
  return apiCall(`/api/showstopper/trailer-moments/${projectId}`, { method: 'POST' });
}

export async function posterQuotes(projectId: string) {
  return apiCall(`/api/showstopper/poster-quotes/${projectId}`, { method: 'POST' });
}
