import { apiCall, apiDownload } from './client';
import type { BookMap } from '../types/book';

export function getBookMap(projectId: string) {
  return apiCall<BookMap>(`/api/projects/${projectId}/book-map`);
}

export function generateBookMap(projectId: string) {
  return apiCall<BookMap & { outputId: string }>(`/api/projects/${projectId}/book-map/generate`, {
    method: 'POST',
  });
}

export function finishBook(body: {
  projectId: string;
  mode: 'diagnose' | 'plan' | 'write-next-chapter' | 'fill-gap' | 'finish-roadmap';
  targetWords?: number;
  desiredOutcome?: string;
  currentText?: string;
}) {
  return apiCall<Record<string, unknown>>('/api/casper/finish-book', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function suggestNextChapters(body: {
  projectId: string;
  manuscriptText?: string;
  targetLength?: number;
  targetGenre?: string;
  desiredEnding?: string;
}) {
  return apiCall<{ outputId: string; missingChapters: unknown[]; nextBestChapter: unknown }>(
    '/api/casper/suggest-next-chapters',
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function trashToTreasure(body: {
  projectId?: string;
  title?: string;
  material: string;
  problem?: string;
  desiredOutcome: string;
  tone?: string;
}) {
  return apiCall<Record<string, unknown>>('/api/casper/trash-to-treasure', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function exportMarkdownManuscript(projectId: string) {
  return apiCall<{ markdown: string }>(`/api/projects/${projectId}/export/markdown`);
}

export function exportDocxManuscript(projectId: string) {
  return apiCall<{ docxPath: string; outputId: string; filename: string }>(
    `/api/projects/${projectId}/export/docx`,
  );
}

export function downloadDocxManuscript(projectId: string, filename?: string) {
  return apiDownload(`/api/projects/${projectId}/export/docx/download`, filename ?? 'manuscript.docx');
}

export function exportProjectArchive(projectId: string) {
  return apiCall<{ archivePath: string; outputId: string }>(`/api/projects/${projectId}/export/archive`, {
    method: 'POST',
  });
}

export function createProjectSnapshot(projectId: string, body?: { label?: string; reason?: string }) {
  return apiCall<{ id: string }>(`/api/projects/${projectId}/snapshot`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}
