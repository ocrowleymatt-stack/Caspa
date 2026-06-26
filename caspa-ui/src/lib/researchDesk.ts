export type ResearchVerificationStatus =
  | 'unverified'
  | 'confirmed'
  | 'contradicted'
  | 'fiction-canon';

export type ResearchSourceType = 'user' | 'ai-suggestion' | 'imported';

export type ResearchQueueStatus = 'queued' | 'active' | 'done';

export const VERIFICATION_LABELS: Record<ResearchVerificationStatus, string> = {
  unverified: 'Unverified',
  confirmed: 'Confirmed',
  contradicted: 'Contradicted',
  'fiction-canon': 'Fiction canon',
};

export const VERIFICATION_STYLES: Record<ResearchVerificationStatus, string> = {
  unverified: 'border-amber-200 bg-amber-50 text-amber-800',
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  contradicted: 'border-red-200 bg-red-50 text-red-800',
  'fiction-canon': 'border-violet-200 bg-violet-50 text-violet-800',
};
