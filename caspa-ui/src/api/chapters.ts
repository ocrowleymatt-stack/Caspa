import { apiCall } from './client';
import type { Chapter, ChapterHistoryEntry } from '../types';

export async function listChapters(projectId: string): Promise<Chapter[]> {
  return apiCall<Chapter[]>(`/api/projects/${projectId}/chapters`);
}

export async function getChapter(id: string): Promise<Chapter> {
  return apiCall<Chapter>(`/api/chapters/${id}`);
}

export async function createChapter(
  projectId: string,
  data: { title: string; order: number; content?: string; status?: Chapter['status'] },
): Promise<Chapter> {
  return apiCall<Chapter>(`/api/projects/${projectId}/chapters`, {
    method: 'POST',
    body: JSON.stringify({
      title: data.title,
      order: data.order,
      content: data.content ?? '',
      status: data.status ?? 'draft',
    }),
  });
}

export async function updateChapter(id: string, data: Partial<Chapter>): Promise<Chapter> {
  return apiCall<Chapter>(`/api/chapters/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteChapter(id: string): Promise<{ id: string }> {
  return apiCall<{ id: string }>(`/api/chapters/${id}`, { method: 'DELETE' });
}

export async function reorderChapters(
  projectId: string,
  orderedIds: string[],
): Promise<{ reordered: boolean }> {
  return apiCall<{ reordered: boolean }>(`/api/projects/${projectId}/chapters/reorder`, {
    method: 'POST',
    body: JSON.stringify({ orderedIds }),
  });
}

export async function getChapterHistory(id: string): Promise<ChapterHistoryEntry[]> {
  return apiCall<ChapterHistoryEntry[]>(`/api/chapters/${id}/history`);
}

export async function restoreChapter(id: string, timestamp: string): Promise<Chapter> {
  return apiCall<Chapter>(`/api/chapters/${id}/restore`, {
    method: 'POST',
    body: JSON.stringify({ timestamp }),
  });
}

export async function listCharacters(projectId: string) {
  return apiCall<import('../types').Character[]>(`/api/projects/${projectId}/characters`);
}

export async function createCharacter(
  projectId: string,
  data: Omit<import('../types').Character, 'id' | 'projectId'>,
) {
  return apiCall<import('../types').Character>(`/api/projects/${projectId}/characters`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCharacter(id: string, data: Partial<import('../types').Character>) {
  return apiCall<import('../types').Character>(`/api/characters/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCharacter(id: string) {
  return apiCall<{ id: string }>(`/api/characters/${id}`, { method: 'DELETE' });
}

export async function getRelationshipMap(projectId: string) {
  return apiCall<{
    nodes: import('../types').Character[];
    edges: { from: string; to: string; type: string }[];
  }>(`/api/projects/${projectId}/relationship-map`);
}
