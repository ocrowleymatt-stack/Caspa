import type { CaspaJob } from './CaspaJobService';

export function buildJobStartResponse(job: CaspaJob) {
  return {
    jobId: job.id,
    status: job.status,
    progressUrl: `/api/jobs/${job.id}/progress`,
    resumeUrl: `/api/jobs/${job.id}`,
    streamUrl: `/api/jobs/${job.id}/stream`,
    message: 'Job started',
  };
}

export function computeJobProgress(job: CaspaJob): number {
  if (job.status === 'completed') return 100;
  if (job.status === 'failed' || job.status === 'cancelled') return 0;
  const total = job.stages.length || 1;
  const completed = job.stages.filter((stage) => stage.status === 'completed').length;
  const running = job.stages.some((stage) => stage.status === 'running') ? 0.5 : 0;
  return Math.min(99, Math.round(((completed + running) / total) * 100));
}

export const NWP_JOB_STAGES = [
  { id: 'prepare', label: 'Preparing project context' },
  { id: 'read-source', label: 'Reading manuscript / source' },
  { id: 'read-bible', label: 'Reading Project Bible' },
  { id: 'read-spec', label: 'Reading Creative Specification' },
  { id: 'plan', label: 'Planning structure' },
  { id: 'draft', label: 'Drafting' },
  { id: 'critic', label: 'Critic-room review' },
  { id: 'rewrite', label: 'Rewriting' },
  { id: 'save', label: 'Saving output' },
  { id: 'complete', label: 'Complete' },
] as const;

export const GOLD_PASS_JOB_STAGES = [
  { id: 'lock', label: 'Locking source' },
  { id: 'spec', label: 'Loading creative specification' },
  { id: 'structure', label: 'Analysing structure' },
  { id: 'critique', label: 'Prose critique' },
  { id: 'continuity', label: 'Continuity check' },
  { id: 'fidelity', label: 'Same-story fidelity check' },
  { id: 'rewrite', label: 'Rewrite pass' },
  { id: 'drift', label: 'Drift check' },
  { id: 'save', label: 'Saving Gold output' },
  { id: 'complete', label: 'Complete' },
] as const;

export const BIBLE_JOB_STAGES = [
  { id: 'load', label: 'Loading project material' },
  { id: 'generate', label: 'Generating Project Bible' },
  { id: 'save', label: 'Saving bible' },
  { id: 'complete', label: 'Complete' },
] as const;

export const BOOK_MAP_JOB_STAGES = [
  { id: 'load', label: 'Loading manuscript context' },
  { id: 'generate', label: 'Generating book map' },
  { id: 'save', label: 'Saving book map' },
  { id: 'complete', label: 'Complete' },
] as const;

export const CUT_ANALYSE_JOB_STAGES = [
  { id: 'load', label: 'Loading section text' },
  { id: 'analyse', label: 'Analysing cuts and tightening' },
  { id: 'save', label: 'Saving analysis' },
  { id: 'complete', label: 'Complete' },
] as const;
