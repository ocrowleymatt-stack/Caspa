import { apiCall } from './client';

export interface AwardLens {
  id: string;
  name: string;
  category: string;
  description: string;
  inspiredBy: string;
  rubricFocus: string[];
  disclaimer: string;
  custom?: boolean;
}

export interface AwardAssessmentResult {
  outputId: string;
  projectId: string;
  overallReadiness: number;
  awardFit: Array<{
    awardId: string;
    awardName: string;
    score: number;
    strengths: string[];
    risks: string[];
    judgeComments: string;
    recommendedRevisions: string[];
    disqualificationOrMismatchRisks: string[];
  }>;
  proseAssessment: {
    voice: number;
    control: number;
    originality: number;
    structure: number;
    emotionalForce: number;
    language: number;
    pace: number;
    depth: number;
  };
  stage: string;
  disclaimer: string;
  createdAt: string;
}

export async function listAwardLenses(): Promise<AwardLens[]> {
  return apiCall<AwardLens[]>('/api/awards');
}

export async function createCustomAwardLens(data: {
  name: string;
  description: string;
  rubricFocus: string[];
  inspiredBy?: string;
  category?: string;
}) {
  return apiCall<AwardLens>('/api/awards/custom', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getProjectAwardsShelf(projectId: string) {
  return apiCall<{
    projectId: string;
    selectedAwardIds: string[];
    awards: AwardLens[];
  }>(`/api/projects/${projectId}/awards`);
}

export async function updateProjectAwardsShelf(projectId: string, awardIds: string[]) {
  return apiCall<{
    projectId: string;
    selectedAwardIds: string[];
    awards: AwardLens[];
  }>(`/api/projects/${projectId}/awards`, {
    method: 'PATCH',
    body: JSON.stringify({ awardIds }),
  });
}

export async function runAwardAssessment(data: {
  projectId: string;
  awardIds: string[];
  sourceText?: string;
  workType?: string;
  stage?: 'draft' | 'revision' | 'submission';
}) {
  return apiCall<AwardAssessmentResult>('/api/awards/assess', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function awardsReadiness(projectId: string) {
  return apiCall(`/api/awards/readiness/${projectId}`, { method: 'POST' });
}

export async function festivalPack(projectId: string) {
  return apiCall(`/api/awards/festival-pack/${projectId}`, { method: 'POST' });
}

export async function artistStatement(projectId: string) {
  return apiCall(`/api/awards/artist-statement/${projectId}`, { method: 'POST' });
}

export async function judgesBrief(projectId: string) {
  return apiCall(`/api/awards/judges-brief/${projectId}`, { method: 'POST' });
}

export async function pullQuotes(projectId: string) {
  return apiCall(`/api/awards/pull-quotes/${projectId}`, { method: 'POST' });
}

export async function categoryFit(projectId: string) {
  return apiCall(`/api/awards/category-fit/${projectId}`, { method: 'POST' });
}
