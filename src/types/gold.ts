/**
 * Gold Pipeline & Novel Write Pro types
 */

export type GoldPassId =
  | 'structure'
  | 'depth'
  | 'subtext'
  | 'line-edit'
  | 'final-cut';

export type NovelWriteProMode =
  | 'novel'
  | 'script'
  | 'musical'
  | 'adaptation'
  | 'polish'
  | 'chaos';

export type QualityGateStatus = 'pass' | 'warn' | 'fail';

export interface GoldPassDefinition {
  id: GoldPassId;
  name: string;
  detail: string;
}

export const GOLD_PASS_DEFINITIONS: GoldPassDefinition[] = [
  {
    id: 'structure',
    name: 'Structure Pass',
    detail: 'Does the spine hold, or is it wearing a hat and pretending?',
  },
  {
    id: 'depth',
    name: 'Depth Pass',
    detail: 'Characters, stakes, world, relationships, pressure.',
  },
  {
    id: 'subtext',
    name: 'Subtext Pass',
    detail: 'Meaning underneath the words. Less furniture, more voltage.',
  },
  {
    id: 'line-edit',
    name: 'Line Edit',
    detail: 'Pace, clarity, rhythm, voice, cuts.',
  },
  {
    id: 'final-cut',
    name: 'Ruthless Final Cut',
    detail: 'Remove what is decorative, dead, duplicated or showing off.',
  },
];

export interface GoldPassResult {
  passId: GoldPassId;
  name: string;
  notes: string;
  revisedText?: string;
  durationMs: number;
}

export interface GoldPipelineResult {
  jobId: string;
  passes: GoldPassResult[];
  finalText: string;
  completedAt: string;
}

export interface GoldPipelineProgressEvent {
  type: 'stage' | 'complete' | 'error';
  jobId: string;
  passId?: GoldPassId;
  passName?: string;
  status?: 'running' | 'done' | 'failed';
  percent?: number;
  notes?: string;
  revisedText?: string;
  message?: string;
  finalText?: string;
}

export interface QualityGateFinding {
  gate: string;
  status: QualityGateStatus;
  score: number;
  issues: string[];
}

export interface NovelQualityPassResult {
  overallScore: number;
  status: QualityGateStatus;
  findings: QualityGateFinding[];
  recommendedRewritePrompt: string;
  wordCount: number;
  mode: NovelWriteProMode;
}

export interface JobAuditSnapshot {
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  queueDepth: number;
  oldestActiveAgeMs: number | null;
  persisted?: boolean;
}

export interface CaspaJobRecord {
  id: string;
  type: 'gold-pipeline' | 'quality-pass';
  status: 'queued' | 'running' | 'complete' | 'failed';
  createdAt: string;
  updatedAt: string;
  progress: number;
  stage?: string;
  error?: string;
  result?: {
    finalText?: string;
    overallScore?: number;
  };
}
