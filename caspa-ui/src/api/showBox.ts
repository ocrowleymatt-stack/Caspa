import { apiCall, apiDownload } from './client';
import type {
  CommercialReadinessReport,
  Cue,
  CueList,
  MarketingCopyPack,
  SocialMediaPack,
} from '../types';

export async function assessProject(projectId: string): Promise<CommercialReadinessReport> {
  return apiCall<CommercialReadinessReport>(`/api/show-box/assess/${projectId}`, {
    method: 'POST',
  });
}

export async function getLatestReport(projectId: string): Promise<CommercialReadinessReport | null> {
  return apiCall<CommercialReadinessReport | null>(`/api/show-box/report/${projectId}`);
}

export async function generateMarketingCopy(projectId: string): Promise<MarketingCopyPack> {
  return apiCall<MarketingCopyPack>(`/api/show-box/marketing/${projectId}`, {
    method: 'POST',
  });
}

export async function generateSocialPack(projectId: string): Promise<SocialMediaPack> {
  return apiCall<SocialMediaPack>(`/api/show-box/social/${projectId}`, {
    method: 'POST',
  });
}

export async function generatePitchDeck(projectId: string): Promise<{ filePath: string }> {
  return apiCall<{ filePath: string }>(`/api/show-box/pitch-deck/${projectId}`, {
    method: 'POST',
  });
}

export async function generatePressKit(projectId: string): Promise<{ filePath: string }> {
  return apiCall<{ filePath: string }>(`/api/show-box/press-kit/${projectId}`, {
    method: 'POST',
  });
}

export async function downloadAsset(type: string, projectId: string): Promise<void> {
  return apiDownload(`/api/show-box/download/${type}/${projectId}`, `${type}-${projectId}`);
}

export async function createCueList(showPackageId: string) {
  return apiCall<CueList>('/api/show-box/cue-list', {
    method: 'POST',
    body: JSON.stringify({ showPackageId }),
  });
}

export async function getCueList(id: string) {
  return apiCall<CueList>(`/api/show-box/cue-list/${id}`);
}

export async function updateCue(cueListId: string, cueId: string, data: Partial<Cue>) {
  return apiCall<Cue>(`/api/show-box/cue-list/${cueListId}/cue/${cueId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function downloadCueListPdf(id: string): Promise<void> {
  return apiDownload(`/api/show-box/cue-list/${id}/pdf`, `cue-list-${id}.pdf`);
}
