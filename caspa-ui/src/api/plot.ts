import { apiCall } from './client';
import type { PlotPoint } from '../types';

export async function listPlotPoints(projectId: string): Promise<PlotPoint[]> {
  return apiCall<PlotPoint[]>(`/api/projects/${projectId}/plot`);
}

export async function createPlotPoint(
  projectId: string,
  data: Omit<PlotPoint, 'id' | 'projectId' | 'order'> & { order?: number },
): Promise<PlotPoint> {
  return apiCall<PlotPoint>(`/api/projects/${projectId}/plot`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePlotPoint(id: string, data: Partial<PlotPoint>): Promise<PlotPoint> {
  return apiCall<PlotPoint>(`/api/plot/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deletePlotPoint(id: string): Promise<{ id: string }> {
  return apiCall<{ id: string }>(`/api/plot/${id}`, { method: 'DELETE' });
}

export async function reorderPlotPoints(
  projectId: string,
  orderedIds: string[],
): Promise<{ reordered: boolean }> {
  return apiCall<{ reordered: boolean }>(`/api/projects/${projectId}/plot/reorder`, {
    method: 'POST',
    body: JSON.stringify({ orderedIds }),
  });
}
