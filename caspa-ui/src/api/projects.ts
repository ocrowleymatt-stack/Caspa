import { apiCall } from './client';
import type { Project, ProjectStats } from '../types';

export async function listProjects(): Promise<Project[]> {
  return apiCall<Project[]>('/api/projects');
}

export async function getProject(id: string): Promise<Project> {
  return apiCall<Project>(`/api/projects/${id}`);
}

export async function createProject(data: {
  title: string;
  genre: string;
  description: string;
  targetWordCount: number;
  status?: Project['status'];
}): Promise<Project> {
  return apiCall<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ ...data, status: data.status ?? 'draft' }),
  });
}

export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
  return apiCall<Project>(`/api/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: string): Promise<{ id: string }> {
  return apiCall<{ id: string }>(`/api/projects/${id}`, { method: 'DELETE' });
}

export async function getProjectStats(id: string): Promise<ProjectStats> {
  return apiCall<ProjectStats>(`/api/projects/${id}/stats`);
}
