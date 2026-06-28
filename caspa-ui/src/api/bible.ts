import { apiCall } from './client';
import { startJobBackedRequest, type JobProgress, type JobStartResponse } from './caspaJobs';

export interface ProjectBibleCharacter {
  name: string;
  role: string;
  wound: string;
  desire: string;
}

export interface ProjectBible {
  projectId: string;
  premise: string;
  genre: string;
  tone: string;
  intendedAudience: string;
  characters: ProjectBibleCharacter[];
  setting: string;
  themes: string[];
  structure: string;
  sourceNotes: string;
  styleRules: string[];
  formatDecision: string;
  scenePlan: string[];
  characterWoundMap: string;
  lastOutputIds: string[];
  updatedAt: string;
}

export function getProjectBible(projectId: string) {
  return apiCall<ProjectBible>(`/api/projects/${projectId}/bible`);
}

export function generateProjectBible(projectId: string, options?: { onProgress?: (progress: JobProgress) => void }) {
  return startJobBackedRequest<ProjectBible>(
    () => apiCall<JobStartResponse>(`/api/projects/${projectId}/bible/generate`, { method: 'POST', body: '{}' }),
    {
      onProgress: options?.onProgress,
      extractResult: (job) => {
        const payload = job.result as { bible?: ProjectBible } | ProjectBible;
        return ('bible' in payload && payload.bible ? payload.bible : payload) as ProjectBible;
      },
    },
  );
}

export function patchProjectBible(projectId: string, patch: Partial<ProjectBible>) {
  return apiCall<ProjectBible>(`/api/projects/${projectId}/bible`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
