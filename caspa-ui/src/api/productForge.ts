import { apiCall } from './client';

export function recommendProducts(projectId: string) {
  return apiCall<unknown>('/api/product-forge/recommend', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export function listProductPlans(projectId?: string) {
  const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return apiCall<unknown[]>(`/api/product-forge/plans${q}`);
}

export function getProductPlan(id: string) {
  return apiCall<unknown>(`/api/product-forge/plans/${id}`);
}
