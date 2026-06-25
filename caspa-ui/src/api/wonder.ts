import { apiCall } from './client';

export async function analyseProject(projectId: string) {
  return apiCall(`/api/wonder/analyse-project/${projectId}`, { method: 'POST' });
}

export async function analyseChapter(chapterId: string) {
  return apiCall(`/api/wonder/analyse-chapter/${chapterId}`, { method: 'POST' });
}

export async function polishText(text: string, projectId?: string) {
  return apiCall('/api/wonder/polish-text', { method: 'POST', body: JSON.stringify({ text, projectId }) });
}

export async function criticPanel(text: string, projectId?: string) {
  return apiCall('/api/wonder/critic-panel', { method: 'POST', body: JSON.stringify({ text, projectId }) });
}

export async function revisionLadder(text: string, projectId?: string) {
  return apiCall('/api/wonder/revision-ladder', { method: 'POST', body: JSON.stringify({ text, projectId }) });
}

export async function audienceSim(text: string, projectId?: string) {
  return apiCall('/api/wonder/audience-sim', { method: 'POST', body: JSON.stringify({ text, projectId }) });
}

export async function listMotifs(projectId?: string) {
  const q = projectId ? `?projectId=${projectId}` : '';
  return apiCall(`/api/wonder/motif-ledger${q}`);
}

export async function createMotif(data: { projectId: string; label: string; description?: string; emotionalWeight?: number }) {
  return apiCall('/api/wonder/motif-ledger', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteMotif(id: string) {
  return apiCall(`/api/wonder/motif-ledger/${id}`, { method: 'DELETE' });
}

export async function getWonderScore(projectId: string) {
  return apiCall(`/api/wonder/score/${projectId}`);
}
