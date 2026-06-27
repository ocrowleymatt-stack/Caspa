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

export interface ManuscriptStructureReport {
  detectedType: string;
  confidence: string;
  units: Array<{ id: string; title: string; type: string; wordCount: number; order: number }>;
  warnings?: string[];
  suggestedNextSteps?: string[];
}

export function analyseStructure(projectId: string, body?: { rawText?: string; filename?: string }) {
  return apiCall<{ report: ManuscriptStructureReport; outputId?: string } | ManuscriptStructureReport>(
    `/api/projects/${projectId}/structure/analyse`,
    { method: 'POST', body: JSON.stringify(body ?? {}) },
  );
}

export function applyStructure(
  projectId: string,
  body?: {
    importMode?: 'split-into-units' | 'whole-manuscript-source' | 'single-unit';
    rawText?: string;
  },
) {
  return apiCall<{
    snapshotId: string;
    chaptersCreated: number;
    unitTitles: string[];
    importMode: string;
  }>(`/api/projects/${projectId}/structure/apply`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function createProjectSnapshot(projectId: string, body?: { label?: string; reason?: string }) {
  return apiCall<{ id: string }>(`/api/projects/${projectId}/snapshot`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function applyManuscriptOutput(
  projectId: string,
  body: {
    outputId: string;
    mode: 'replace-unit' | 'append-unit' | 'new-unit';
    unitId?: string;
    newUnitTitle?: string;
    confirmed: boolean;
  },
) {
  return apiCall<{
    applied: boolean;
    mode: string;
    snapshotId: string;
    unitId: string;
    outputId: string;
    wordCount: number;
  }>(`/api/projects/${projectId}/manuscript/apply-output`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export interface AssembledManuscript {
  projectId: string;
  title: string;
  mode: 'read-only-assemble';
  currentWordCount: number;
  targetWordCount: number;
  completionPercent: number;
  sections: Array<{
    unitId: string;
    title: string;
    order: number;
    wordCount: number;
    unitType?: string;
    unitStatus?: string;
    sourceRole?: string;
    content: string;
    relatedOutputs: Array<{ outputId: string; title: string; kind?: string; hasText: boolean }>;
  }>;
  fullText: string;
  warnings: string[];
  exportReady: boolean;
  assembledAt: string;
}

export function assembleManuscript(projectId: string) {
  return apiCall<AssembledManuscript>(`/api/projects/${projectId}/manuscript/assemble`, {
    method: 'POST',
  });
}
