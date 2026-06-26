/** Research Desk — verification, attachments, and accuracy workflow (Phase 6). */

export type ResearchVerificationStatus =
  | 'unverified'
  | 'confirmed'
  | 'contradicted'
  | 'fiction-canon';

export type ResearchSourceType = 'user' | 'ai-suggestion' | 'imported';

export type ResearchQueueStatus = 'queued' | 'active' | 'done';

export type ResearchAttachmentKind =
  | 'project'
  | 'unit'
  | 'pole'
  | 'output'
  | 'character'
  | 'place';

export interface ResearchAttachment {
  kind: ResearchAttachmentKind;
  id: string;
  label?: string;
}

export type ClaimAccuracyStatus =
  | 'confirmed'
  | 'unverified'
  | 'contradicted'
  | 'fiction-canon'
  | 'missing-research';

export interface ExtractedResearchClaim {
  id: string;
  text: string;
  context: string;
  confidence: number;
  verificationStatus: ResearchVerificationStatus;
  source: 'deterministic' | 'ai';
}

export interface ResearchTopicSuggestion {
  topic: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  verificationStatus: ResearchVerificationStatus;
  sourceType: ResearchSourceType;
}

export interface AccuracyVerdict {
  claimId: string;
  claimText: string;
  status: ClaimAccuracyStatus;
  matchedNoteIds: string[];
  explanation: string;
  aiInference: boolean;
}

export interface ResearchDepthPassResult {
  projectId: string;
  topic: string;
  summary: string;
  gaps: string[];
  suggestedQuestions: ResearchTopicSuggestion[];
  confirmedNoteCount: number;
  unverifiedNoteCount: number;
  disclaimer: string;
}

export const RESEARCH_AI_DISCLAIMER =
  'AI suggestions are unverified by default. User-confirmed research outranks AI inference.';

export const VERIFICATION_LABELS: Record<ResearchVerificationStatus, string> = {
  unverified: 'Unverified',
  confirmed: 'Confirmed',
  contradicted: 'Contradicted',
  'fiction-canon': 'Fiction canon',
};
