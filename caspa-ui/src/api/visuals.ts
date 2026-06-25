import { apiCall } from './client';

export async function visualIdentity(projectId: string) {
  return apiCall(`/api/visuals/identity/${projectId}`, { method: 'POST' });
}

export async function posterCopy(projectId: string) {
  return apiCall(`/api/visuals/poster/${projectId}`, { method: 'POST' });
}

export async function palette(projectId: string) {
  return apiCall(`/api/visuals/palette/${projectId}`, { method: 'POST' });
}

export async function setBrief(showPackageId: string) {
  return apiCall(`/api/visuals/set-brief/${showPackageId}`, { method: 'POST' });
}

export async function costumeBrief(showPackageId: string) {
  return apiCall(`/api/visuals/costume-brief/${showPackageId}`, { method: 'POST' });
}

export async function trailerScript(projectId: string) {
  return apiCall(`/api/visuals/trailer-script/${projectId}`, { method: 'POST' });
}
