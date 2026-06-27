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
