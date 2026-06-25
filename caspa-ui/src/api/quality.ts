import { apiCall } from './client';

export async function checkText(text: string) {
  return apiCall('/api/quality/check-text', { method: 'POST', body: JSON.stringify({ text }) });
}

export async function checkProject(projectId: string) {
  return apiCall(`/api/quality/check-project/${projectId}`, { method: 'POST' });
}

export async function checkShow(showPackageId: string) {
  return apiCall(`/api/quality/check-show/${showPackageId}`, { method: 'POST' });
}

export async function checkMarketing(text: string) {
  return apiCall('/api/quality/check-marketing', { method: 'POST', body: JSON.stringify({ text }) });
}

export async function finalGate(projectId: string) {
  return apiCall(`/api/quality/final-gate/${projectId}`, { method: 'POST' });
}
