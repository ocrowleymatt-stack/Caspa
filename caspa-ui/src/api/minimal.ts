import { apiCall, apiDownload } from './client';
import type { Project } from '../types';

export type MinimalPhase = 'empty' | 'material' | 'built' | 'drafted' | 'improved' | 'exported';

export interface MinimalWorkflowState {
  projectId: string;
  phase: MinimalPhase;
  writeProgress: number;
  materialCount: number;
  wordCount: number;
  targetWordCount: number;
  preview: string;
  statusMessage: string;
  lastAction?: string;
  updatedAt: string;
}

export interface MinimalActionResult {
  message: string;
  state: MinimalWorkflowState;
  outputId?: string;
  driftBlocked?: boolean;
  downloadUrl?: string;
  docxFilename?: string;
}

export async function createMinimalProject(input?: {
  title?: string;
  targetWordCount?: number;
}): Promise<Project> {
  return apiCall<Project>('/api/minimal/projects', {
    method: 'POST',
    body: JSON.stringify(input ?? {}),
  });
}

export async function getMinimalState(projectId: string): Promise<MinimalWorkflowState> {
  return apiCall<MinimalWorkflowState>(`/api/projects/${projectId}/minimal/state`);
}

export async function minimalAutoBuild(projectId: string): Promise<MinimalActionResult> {
  return apiCall<MinimalActionResult>(`/api/projects/${projectId}/minimal/auto-build`, {
    method: 'POST',
    body: '{}',
  });
}

export async function minimalAutoWrite(projectId: string): Promise<MinimalActionResult> {
  return apiCall<MinimalActionResult>(`/api/projects/${projectId}/minimal/auto-write`, {
    method: 'POST',
    body: '{}',
  });
}

export async function minimalImprove(projectId: string): Promise<MinimalActionResult> {
  return apiCall<MinimalActionResult>(`/api/projects/${projectId}/minimal/improve`, {
    method: 'POST',
    body: '{}',
  });
}

export async function minimalExport(projectId: string): Promise<MinimalActionResult> {
  return apiCall<MinimalActionResult>(`/api/projects/${projectId}/minimal/export`, {
    method: 'POST',
    body: '{}',
  });
}

export async function downloadMinimalDocx(projectId: string, filename?: string): Promise<void> {
  return apiDownload(`/api/projects/${projectId}/export/docx/download`, filename ?? 'manuscript.docx');
}
