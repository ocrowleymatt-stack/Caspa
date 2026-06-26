import { apiCall } from './client';
import type { ResearchNote } from '../types';
import type {
  ResearchQueueStatus,
  ResearchSourceType,
  ResearchVerificationStatus,
} from '../lib/researchDesk';

export async function listResearchNotes(
  projectId: string,
  tags?: string[],
): Promise<ResearchNote[]> {
  const qs = tags?.length ? `?tags=${tags.join(',')}` : '';
  return apiCall<ResearchNote[]>(`/api/projects/${projectId}/research${qs}`);
}

export async function listResearchDeskNotes(
  projectId: string,
  tags?: string[],
): Promise<ResearchNote[]> {
  const params = new URLSearchParams({ projectId });
  if (tags?.length) params.set('tags', tags.join(','));
  return apiCall<ResearchNote[]>(`/api/research?${params.toString()}`);
}

export async function searchResearchNotes(
  projectId: string,
  query: string,
): Promise<ResearchNote[]> {
  const qs = query ? `?q=${encodeURIComponent(query)}` : '';
  return apiCall<ResearchNote[]>(`/api/projects/${projectId}/research/search${qs}`);
}

export async function getResearchNote(id: string): Promise<ResearchNote> {
  return apiCall<ResearchNote>(`/api/research/${id}`);
}

export async function createResearchNote(
  projectId: string,
  data: Omit<ResearchNote, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>,
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
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteResearchNote(id: string): Promise<{ id: string }> {
  return apiCall<{ id: string }>(`/api/research/${id}`, { method: 'DELETE' });
}

export async function suggestResearchTopics(
  projectId: string,
  data?: { sourceText?: string; query?: string },
) {
  return apiCall<{
    topics: Array<{
      topic: string;
      reason: string;
      priority: 'high' | 'medium' | 'low';
      verificationStatus: ResearchVerificationStatus;
      sourceType: ResearchSourceType;
    }>;
    disclaimer: string;
  }>('/api/research/suggest-topics', {
    method: 'POST',
    body: JSON.stringify({ projectId, ...data }),
  });
}

export async function extractResearchClaims(projectId: string, text: string) {
  return apiCall<{
    claims: Array<{
      id: string;
      text: string;
      context: string;
      confidence: number;
      verificationStatus: ResearchVerificationStatus;
      source: string;
    }>;
    disclaimer: string;
  }>('/api/research/extract-claims', {
    method: 'POST',
    body: JSON.stringify({ projectId, text }),
  });
}

export async function checkResearchAccuracy(
  projectId: string,
  data: { sourceText?: string; claims?: Array<{ id?: string; text: string }> },
) {
  return apiCall<{
    verdicts: Array<{
      claimId: string;
      claimText: string;
      status: string;
      matchedNoteIds: string[];
      explanation: string;
      aiInference: boolean;
    }>;
    disclaimer: string;
    confirmedLibraryUsed: boolean;
  }>('/api/research/check-accuracy', {
    method: 'POST',
    body: JSON.stringify({ projectId, ...data }),
  });
}

export async function runResearchDepthPass(
  projectId: string,
  data?: { topic?: string; unitId?: string },
) {
  return apiCall<{
    projectId: string;
    topic: string;
    summary: string;
    gaps: string[];
    suggestedQuestions: Array<{
      topic: string;
      reason: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    confirmedNoteCount: number;
    unverifiedNoteCount: number;
    disclaimer: string;
  }>('/api/research/depth-pass', {
    method: 'POST',
    body: JSON.stringify({ projectId, ...data }),
  });
}

export async function queueResearchNote(id: string, queueStatus: ResearchQueueStatus) {
  return updateResearchNote(id, { queueStatus });
}
