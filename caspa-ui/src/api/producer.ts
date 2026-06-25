import { apiCall } from './client';

export async function budget(showPackageId: string) {
  return apiCall(`/api/producer/budget/${showPackageId}`, { method: 'POST' });
}

export async function venueFit(showPackageId: string) {
  return apiCall(`/api/producer/venue-fit/${showPackageId}`, { method: 'POST' });
}

export async function rightsRisk(projectId: string) {
  return apiCall(`/api/producer/rights-risk/${projectId}`, { method: 'POST' });
}

export async function schedule(showPackageId: string) {
  return apiCall(`/api/producer/schedule/${showPackageId}`, { method: 'POST' });
}

export async function castCrew(showPackageId: string) {
  return apiCall(`/api/producer/cast-crew/${showPackageId}`, { method: 'POST' });
}

export async function revenue(showPackageId: string) {
  return apiCall(`/api/producer/revenue/${showPackageId}`, { method: 'POST' });
}
