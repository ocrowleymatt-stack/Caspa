import { apiCall } from './client';
import type { JobStatus, MusicTrack, OvernightSchedule } from '../types';

export async function listTracks(projectId?: string): Promise<MusicTrack[]> {
  const qs = projectId ? `?projectId=${projectId}` : '';
  return apiCall<MusicTrack[]>(`/api/music-lab/tracks${qs}`);
}

export async function getTrack(id: string) {
  return apiCall<{ track: MusicTrack; brief?: unknown }>(`/api/music-lab/tracks/${id}`);
}

export async function createTrack(data: {
  genre: string;
  mood: string;
  tempo: number;
  duration: number;
  description?: string;
  projectId?: string;
  title?: string;
}): Promise<MusicTrack> {
  return apiCall<MusicTrack>('/api/music-lab/tracks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteTrack(id: string): Promise<{ id: string }> {
  return apiCall<{ id: string }>(`/api/music-lab/tracks/${id}`, { method: 'DELETE' });
}

export async function generateChapterTheme(chapterId: string): Promise<MusicTrack> {
  return apiCall<MusicTrack>('/api/music-lab/generate/chapter', {
    method: 'POST',
    body: JSON.stringify({ chapterId }),
  });
}

export async function generateCharacterLeitmotif(characterId: string): Promise<MusicTrack> {
  return apiCall<MusicTrack>('/api/music-lab/generate/character', {
    method: 'POST',
    body: JSON.stringify({ characterId }),
  });
}

export async function generateAtmosphericPack(projectId: string): Promise<MusicTrack[]> {
  return apiCall<MusicTrack[]>('/api/music-lab/generate/pack', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export async function scheduleOvernight(data: {
  projectId: string;
  trackCount: number;
  startHour: number;
}): Promise<{ scheduleId: string }> {
  return apiCall<{ scheduleId: string }>('/api/music-lab/overnight/schedule', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listOvernightSchedules(): Promise<OvernightSchedule[]> {
  return apiCall<OvernightSchedule[]>('/api/music-lab/overnight');
}

export async function cancelOvernightSchedule(id: string): Promise<{ id: string }> {
  return apiCall<{ id: string }>(`/api/music-lab/overnight/${id}`, { method: 'DELETE' });
}

export async function getMusicJobStatus(id: string): Promise<JobStatus> {
  return apiCall<JobStatus>(`/api/music-lab/jobs/${id}`);
}
