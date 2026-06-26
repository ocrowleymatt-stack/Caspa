import { apiCall } from './client';
import type {
  Fictionality,
  Project,
  StructureType,
  TargetMarket,
  WorkForm,
  WorkflowStage,
  WorkType,
} from '../types';

export async function listProjects(): Promise<Project[]> {
  return apiCall<Project[]>('/api/projects');
}

export async function getProject(id: string): Promise<Project> {
  return apiCall<Project>(`/api/projects/${id}`);
}

export type CreateProjectInput = {
  title: string;
  genre: string;
  description: string;
  targetWordCount: number;
  status?: Project['status'];
  hasImportedManuscript?: boolean;
  workType?: WorkType;
  fictionality?: Fictionality;
  form?: WorkForm;
  subgenre?: string;
  targetAudience?: string;
  targetPrizeIds?: string[];
  targetMarket?: TargetMarket;
  structureType?: StructureType;
  workflowStage?: WorkflowStage;
};

export async function createProject(data: CreateProjectInput): Promise<Project> {
  return apiCall<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ ...data, status: data.status ?? 'draft' }),
  });
}

export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
  return apiCall<Project>(`/api/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: string): Promise<{ id: string }> {
  return apiCall<{ id: string }>(`/api/projects/${id}`, { method: 'DELETE' });
}

export async function getProjectStats(id: string): Promise<import('../types').ProjectStats> {
  return apiCall(`/api/projects/${id}/stats`);
}
