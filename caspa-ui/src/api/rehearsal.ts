import { apiCall } from './client';

export async function tableRead(showPackageId: string) {
  return apiCall(`/api/rehearsal/table-read/${showPackageId}`, { method: 'POST' });
}

export async function dialogueCheck(text: string) {
  return apiCall('/api/rehearsal/dialogue-check', { method: 'POST', body: JSON.stringify({ text }) });
}

export async function blocking(showPackageId: string) {
  return apiCall(`/api/rehearsal/blocking/${showPackageId}`, { method: 'POST' });
}

export async function pacing(showPackageId: string) {
  return apiCall(`/api/rehearsal/pacing/${showPackageId}`, { method: 'POST' });
}

export async function castability(showPackageId: string) {
  return apiCall(`/api/rehearsal/castability/${showPackageId}`, { method: 'POST' });
}

export async function rehearsalNotes(showPackageId: string) {
  return apiCall(`/api/rehearsal/notes/${showPackageId}`, { method: 'POST' });
}
