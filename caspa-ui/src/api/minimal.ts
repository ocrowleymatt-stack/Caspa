import { apiCall, apiDownload } from './client';
import type { Project } from '../types';

export type MinimalPhase = 'empty' | 'material' | 'built' | 'drafted' | 'improved' | 'exported';
export type MinimalStepId = 'drop' | 'build' | 'write' | 'improve' | 'export';

export interface MinimalStep {
  id: MinimalStepId;
  label: string;
  status: 'done' | 'current' | 'ready' | 'locked';
  detail: string;
}

export interface MinimalCapabilities {
  canBuild: boolean;
  canWrite: boolean;
  canImprove: boolean;
  canExport: boolean;
  buildReason?: string;
  writeReason?: string;
  improveReason?: string;
  exportReason?: string;
}

export interface MinimalWorkflowState {
  projectId: string;
  projectTitle: string;
  phase: MinimalPhase;
  writeProgress: number;
  materialCount: number;
  materialChars: number;
  chapterCount: number;
  wordCount: number;
  targetWordCount: number;
  preview: string;
  statusMessage: string;
  nextAction: MinimalStepId;
  steps: MinimalStep[];
  capabilities: MinimalCapabilities;
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

export function actionDisabledReason(
  state: MinimalWorkflowState | undefined,
  action: Exclude<MinimalStepId, 'drop'>,
): string | undefined {
  if (!state) return 'Loading workflow…';
  const caps = state.capabilities;
  if (action === 'build') return caps.canBuild ? undefined : caps.buildReason;
  if (action === 'write') return caps.canWrite ? undefined : caps.writeReason;
  if (action === 'improve') return caps.canImprove ? undefined : caps.improveReason;
  if (action === 'export') return caps.canExport ? undefined : caps.exportReason;
  return undefined;
}

export function canRunAction(state: MinimalWorkflowState | undefined, action: MinimalStepId): boolean {
  if (!state || action === 'drop') return action === 'drop';
  if (action === 'build') return state.capabilities.canBuild;
  if (action === 'write') return state.capabilities.canWrite;
  if (action === 'improve') return state.capabilities.canImprove;
  return state.capabilities.canExport;
}
