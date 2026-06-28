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

export const GOLD_PIPELINE_JOB_STAGES = [
  { id: 'manuscript_ingest', label: 'Manuscript Ingest' },
  { id: 'structural_vector_mapping', label: 'Structural Vector Mapping' },
  { id: 'scene_function_analysis', label: 'Scene Function Analysis' },
  { id: 'prose_quality_pass', label: 'Prose Quality Pass' },
  { id: 'voice_consistency_calibration', label: 'Voice Consistency Calibration' },
  { id: 'dialogue_veracity_audit', label: 'Dialogue Veracity Audit' },
  { id: 'subtext_motif_detection', label: 'Subtext & Motif Detection' },
  { id: 'sensory_detail_expansion', label: 'Sensory Detail Expansion' },
  { id: 'pacing_tension_mapping', label: 'Pacing & Tension Mapping' },
  { id: 'lexical_density_sweep', label: 'Lexical Density Sweep' },
  { id: 'micro_tension_polish', label: 'Micro-Tension Polish' },
  { id: 'final_gold_framework', label: 'Final Gold Framework' },
  { id: 'complete', label: 'Complete' },
] as const;

export const AGENT_SWARM_JOB_STAGES = [
  { id: 'load', label: 'Loading project context' },
  { id: 'agents', label: 'Running agent reports' },
  { id: 'consensus', label: 'Synthesizing consensus' },
  { id: 'revision', label: 'Revision pass' },
  { id: 'save', label: 'Saving swarm output' },
  { id: 'complete', label: 'Complete' },
] as const;

export const MINIMAL_AUTO_BUILD_JOB_STAGES = [
  { id: 'import', label: 'Importing material' },
  { id: 'structure', label: 'Analysing structure' },
  { id: 'bible', label: 'Generating story bible' },
  { id: 'book-map', label: 'Generating book map' },
  { id: 'finalize', label: 'Finalizing build' },
  { id: 'complete', label: 'Complete' },
] as const;

export const MINIMAL_AUTO_WRITE_JOB_STAGES = [
  { id: 'prepare', label: 'Preparing section' },
  { id: 'draft', label: 'Drafting with Novel Write Pro' },
  { id: 'apply', label: 'Applying to manuscript' },
  { id: 'complete', label: 'Complete' },
] as const;

export const MINIMAL_IMPROVE_JOB_STAGES = [
  { id: 'lock', label: 'Locking source' },
  { id: 'improve', label: 'Gold Pass polish' },
  { id: 'apply', label: 'Applying improvements' },
  { id: 'complete', label: 'Complete' },
] as const;
