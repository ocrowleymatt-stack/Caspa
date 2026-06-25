import { apiCall } from './client';
import type { TasteProfile } from '../types';

export async function listTasteProfiles() {
  return apiCall<TasteProfile[]>('/api/taste/profiles');
}

export async function extractStyle(text: string, projectId?: string) {
  return apiCall('/api/taste/extract-style', { method: 'POST', body: JSON.stringify({ text, projectId }) });
}

export async function applyProfile(profileId: string, text: string) {
  return apiCall('/api/taste/apply-profile', { method: 'POST', body: JSON.stringify({ profileId, text }) });
}

export async function compareOutput(profileId: string, textA: string, textB: string) {
  return apiCall('/api/taste/compare-output', { method: 'POST', body: JSON.stringify({ profileId, textA, textB }) });
}
