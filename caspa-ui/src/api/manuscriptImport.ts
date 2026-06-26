import { apiCall } from './client';
import type { StructureType, WorkType } from '../lib/workModel';

export type RecommendedImportMode =
  | 'whole-manuscript-source'
  | 'split-into-units'
  | 'single-unit'
  | 'research-notes';

export interface DetectedUnit {
  type: 'chapter' | 'act' | 'scene' | 'section' | 'essay' | 'poem' | 'note';
  title: string;
  startIndex: number;
  endIndex: number;
  wordCount: number;
}

export interface ImportAnalysisResult {
  detectedWorkType: WorkType;
  confidence: 'high' | 'medium' | 'low';
  detectedUnits: DetectedUnit[];
  recommendedImportMode: RecommendedImportMode;
  warnings: string[];
  totalWordCount: number;
  structureType: StructureType;
}

export function analyseManuscriptImport(body: {
  projectId?: string;
  filename?: string;
  rawText: string;
  declaredWorkType?: WorkType;
}) {
  return apiCall<ImportAnalysisResult>('/api/manuscript/import/analyse', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function applyManuscriptImport(body: {
  projectId: string;
  rawText: string;
  filename?: string;
  importMode: RecommendedImportMode;
  detectedUnits?: DetectedUnit[];
  workType?: WorkType;
}) {
  return apiCall<{
    projectId: string;
    importMode: RecommendedImportMode;
    chaptersCreated: number;
    researchNotesCreated: number;
    unitTitles: string[];
  }>('/api/manuscript/import/apply', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export const IMPORT_MODE_LABELS: Record<RecommendedImportMode, string> = {
  'whole-manuscript-source': 'Keep as whole manuscript source',
  'split-into-units': 'Split into detected chapters/scenes/sections',
  'single-unit': 'Treat as single chapter/scene',
  'research-notes': 'Treat as research notes',
};
