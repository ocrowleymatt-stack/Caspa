import { apiCall } from './client';

export async function awardsReadiness(projectId: string) {
  return apiCall(`/api/awards/readiness/${projectId}`, { method: 'POST' });
}

export async function festivalPack(projectId: string) {
  return apiCall(`/api/awards/festival-pack/${projectId}`, { method: 'POST' });
}

export async function artistStatement(projectId: string) {
  return apiCall(`/api/awards/artist-statement/${projectId}`, { method: 'POST' });
}

export async function judgesBrief(projectId: string) {
  return apiCall(`/api/awards/judges-brief/${projectId}`, { method: 'POST' });
}

export async function pullQuotes(projectId: string) {
  return apiCall(`/api/awards/pull-quotes/${projectId}`, { method: 'POST' });
}

export async function categoryFit(projectId: string) {
  return apiCall(`/api/awards/category-fit/${projectId}`, { method: 'POST' });
}
