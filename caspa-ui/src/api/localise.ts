import { apiCall } from './client';

export async function localiseProject(projectId: string, community?: string) {
  return apiCall(`/api/localise/project/${projectId}`, { method: 'POST', body: JSON.stringify({ community }) });
}

export async function localiseShow(showPackageId: string, region?: string) {
  return apiCall(`/api/localise/show/${showPackageId}`, { method: 'POST', body: JSON.stringify({ region }) });
}

export async function localJokes(region: string, context?: string, projectId?: string) {
  return apiCall('/api/localise/local-jokes', { method: 'POST', body: JSON.stringify({ region, context, projectId }) });
}

export async function castSize(castSize: number, venueCapacity: number) {
  return apiCall('/api/localise/cast-size', { method: 'POST', body: JSON.stringify({ castSize, venueCapacity }) });
}

export async function venueCustom(venueType: string, showType: string) {
  return apiCall('/api/localise/venue', { method: 'POST', body: JSON.stringify({ venueType, showType }) });
}

export async function sponsorSafe(context: string, sponsor?: string) {
  return apiCall('/api/localise/sponsor-safe', { method: 'POST', body: JSON.stringify({ context, sponsor }) });
}
