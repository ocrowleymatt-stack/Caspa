import { apiCall } from './client';
import type { ResearchNote } from '../types';

export async function listResearchNotes(
  projectId: string,
  tags?: string[],
): Promise<ResearchNote[]> {
  const qs = tags?.length ? `?tags=${tags.join(',')}` : '';
  return apiCall<ResearchNote[]>(`/api/projects/${projectId}/research${qs}`);
}

export async function searchResearchNotes(
  projectId: string,
  query: string,
): Promise<ResearchNote[]> {
  const qs = query ? `?q=${encodeURIComponent(query)}` : '';
  return apiCall<ResearchNote[]>(`/api/projects/${projectId}/research/search${qs}`);
}

export async function createResearchNote(
  projectId: string,
  data: Omit<ResearchNote, 'id' | 'projectId' | 'createdAt'>,
): Promise<ResearchNote> {
  return apiCall<ResearchNote>(`/api/projects/${projectId}/research`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateResearchNote(
  id: string,
  data: Partial<ResearchNote>,
): Promise<ResearchNote> {
  return apiCall<ResearchNote>(`/api/research/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteResearchNote(id: string): Promise<{ id: string }> {
  return apiCall<{ id: string }>(`/api/research/${id}`, { method: 'DELETE' });
}
