/**
 * Caspa export profiles and gate contracts
 */

import type { Diagnosis } from './commission';
import type { StoryPromise } from './promise';

export type ExportProfile = 'kdp-novel' | 'course-book' | 'subject-bible' | 'markdown' | 'screen-pdf';

export interface ExportProfileMeta {
  id: ExportProfile;
  label: string;
  detail: string;
  trim: string;
}

export const EXPORT_PROFILES: ExportProfileMeta[] = [
  { id: 'kdp-novel', label: 'KDP Novel', detail: '6×9 trim, serif, chapter breaks — Amazon print-ready layout', trim: '6×9 in' },
  { id: 'course-book', label: 'Course Book', detail: 'A4 modules, callout boxes, exercise blocks', trim: 'A4' },
  { id: 'subject-bible', label: 'Subject Bible', detail: 'Reference layout, dense typography, index-friendly', trim: 'A4' },
  { id: 'screen-pdf', label: 'Screen PDF', detail: 'Fast digital PDF for review and sharing', trim: 'Letter' },
  { id: 'markdown', label: 'Markdown', detail: 'Plain .md file for version control or other tools', trim: '—' },
];

export interface ExportGateResult {
  canExport: boolean;
  blocked: boolean;
  blockers: string[];
  warnings: string[];
  wordCount: number;
}

export interface ExportContext {
  title: string;
  author: string;
  manuscript: string;
  promises: StoryPromise[];
  diagnosis: Diagnosis | null;
  audience: string;
  tone: string;
}

export interface ContentAnalysisSummary {
  documentType?: string;
  estimatedPages?: number;
  readiness?: number;
  blockers?: string[];
  suggestions?: string[];
  illustrationCount?: number;
}
