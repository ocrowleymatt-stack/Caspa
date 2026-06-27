import { apiCall } from './client';

export type AssetKind =
  | 'manuscript'
  | 'chapter'
  | 'outline'
  | 'research'
  | 'receipt'
  | 'prop'
  | 'character-note'
  | 'setting-note'
  | 'dialogue-sample'
  | 'style-sample'
  | 'legal-admin'
  | 'image-reference'
  | 'unknown';

export type DetectedUse =
  | 'manuscript'
  | 'chapter'
  | 'outline'
  | 'research'
  | 'receipt'
  | 'prop'
  | 'character note'
  | 'setting note'
  | 'dialogue sample'
  | 'style sample'
  | 'legal/admin artifact'
  | 'image reference'
  | 'unknown';

export interface ProjectAsset {
  id: string;
  projectId: string;
  title: string;
  originalFilename?: string;
  kind: AssetKind;
  mimeType?: string;
  sourceText: string;
  extractedText: string;
  summary?: string;
  detectedUse: DetectedUse;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export type ProductType =
  | 'novel'
  | 'memoir'
  | 'short-story'
  | 'stage-play'
  | 'screenplay'
  | 'musical'
  | 'comedy-sketch'
  | 'childrens-story'
  | 'poetry-collection'
  | 'nonfiction-book'
  | 'essay'
  | 'pitch-deck'
  | 'treatment'
  | 'project-bible'
  | 'book-map'
  | 'submission-package'
  | 'research-dossier'
  | 'evidence-report'
  | 'marketing-pack'
  | 'show-in-a-box'
  | 'educational-resource'
  | 'custom';

export interface CreativeTarget {
  readerEffects?: string[];
  audienceAfterthought?: string;
  aftertaste?: string;
  intensity?: number;
  literaryBalance?:
    | 'very-commercial'
    | 'commercial-intelligent'
    | 'upmarket'
    | 'literary'
    | 'prize-target'
    | 'experimental';
  optimizeFor?: string[];
  avoid?: string[];
  sourceTruthMode?:
    | 'keep-close'
    | 'light-fiction'
    | 'heavy-fiction'
    | 'anonymise'
    | 'pure-fiction'
    | 'ask';
  targetChapterCount?: number;
  targetSceneCount?: number;
  targetActCount?: number;
  idealChapterLength?: number;
  idealSceneLength?: number;
  lengthPreset?: string;
}

export interface ProductionBrief {
  projectId: string;
  productType: ProductType;
  audience?: string;
  tone?: string;
  genre?: string;
  marketPosition?: string;
  awardTarget?: string;
  targetLength?: number;
  sourceAssets: string[];
  excludedAssets: string[];
  privacyMode?: 'local-first' | 'cloud-allowed' | 'hybrid';
  aiStrategy?: string;
  exportTargets: string[];
  successCriteria?: string;
  creativeTarget?: CreativeTarget;
  updatedAt: string;
}

export type GuideProjectState =
  | 'blank'
  | 'idea'
  | 'assets-uploaded'
  | 'rough-material'
  | 'manuscript-imported'
  | 'structured'
  | 'bible-ready'
  | 'book-map-ready'
  | 'drafting'
  | 'revising'
  | 'export-ready'
  | 'submission-ready';

export interface GuideStep {
  id: string;
  label: string;
  status: 'done' | 'recommended' | 'optional' | 'missing';
  actionPath?: string;
  explanation: string;
}

export interface GuideState {
  projectId: string;
  state: GuideProjectState;
  missingSteps: string[];
  recommendedNextAction: {
    label: string;
    path: string;
    reason: string;
  };
  secondaryActions: Array<{ label: string; path: string }>;
  warnings: string[];
  confidence: number;
  steps: GuideStep[];
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface IntimacySettings {
  projectId: string;
  enabled: boolean;
  defaultHeatLevel: HeatLevel;
  adultOnly: boolean;
  askBeforeIncreasingHeat: boolean;
  clarificationMode: 'always-ask' | 'ambiguous-only' | 'project-default' | 'fade-unless-requested';
  boundaries: string[];
  defaultTone?: string;
  consentRequirement: boolean;
  notes?: string;
  updatedAt: string;
}

export interface ProviderTestResult {
  testedAt: string;
  elapsedMs: number;
  providers: Array<Record<string, unknown>>;
}

export async function listProjectAssets(projectId: string): Promise<ProjectAsset[]> {
  return apiCall<ProjectAsset[]>(`/api/projects/${projectId}/assets`);
}

export async function createProjectAsset(
  projectId: string,
  input: {
    title?: string;
    originalFilename?: string;
    mimeType?: string;
    sourceText: string;
    tags?: string[];
    kind?: AssetKind;
    detectedUse?: DetectedUse;
  },
): Promise<ProjectAsset> {
  return apiCall<ProjectAsset>(`/api/projects/${projectId}/assets`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function patchProjectAsset(
  projectId: string,
  assetId: string,
  patch: Partial<Pick<ProjectAsset, 'title' | 'kind' | 'detectedUse' | 'tags' | 'summary'>>,
): Promise<ProjectAsset> {
  return apiCall<ProjectAsset>(`/api/projects/${projectId}/assets/${assetId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteProjectAsset(projectId: string, assetId: string): Promise<{ deleted: boolean }> {
  return apiCall<{ deleted: boolean }>(`/api/projects/${projectId}/assets/${assetId}`, {
    method: 'DELETE',
  });
}

export async function getProductionBrief(projectId: string): Promise<ProductionBrief> {
  return apiCall<ProductionBrief>(`/api/projects/${projectId}/production-brief`);
}

export async function generateProductionBrief(projectId: string): Promise<ProductionBrief> {
  return apiCall<ProductionBrief>(`/api/projects/${projectId}/production-brief/generate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function patchProductionBrief(
  projectId: string,
  patch: Partial<ProductionBrief>,
): Promise<ProductionBrief> {
  return apiCall<ProductionBrief>(`/api/projects/${projectId}/production-brief`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function getGuideState(projectId: string): Promise<GuideState> {
  return apiCall<GuideState>(`/api/projects/${projectId}/guide-state`);
}

export async function getIntimacySettings(projectId: string): Promise<IntimacySettings> {
  return apiCall<IntimacySettings>(`/api/projects/${projectId}/intimacy-settings`);
}

export async function patchIntimacySettings(
  projectId: string,
  patch: Partial<IntimacySettings>,
): Promise<IntimacySettings> {
  return apiCall<IntimacySettings>(`/api/projects/${projectId}/intimacy-settings`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function testAllProviders(): Promise<ProviderTestResult> {
  return apiCall<ProviderTestResult>('/api/providers/test-all', { method: 'POST', body: '{}' });
}
