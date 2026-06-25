import type { GoldRunOptions } from '../../api/gold';
import type { GoldReport } from '../../types';

export type StepStatus = 'pending' | 'running' | 'done' | 'error';

export type PassDepth = GoldRunOptions['depth'];
export type ModelRoute = GoldRunOptions['route'];
export type RunMode = GoldRunOptions['runMode'];
export type OutputTab = 'final' | 'changeLog' | 'beforeAfter' | 'risk' | 'export';

export interface PipelineStep {
  id: number;
  stage: string;
  label: string;
  detail: string;
  status: StepStatus;
  progress: number;
}

export interface PipelineRunEvent {
  run_id: string;
  stage: string;
  status: StepStatus;
  message: string;
  progress: number;
  current_chapter?: string;
  warnings?: string[];
}

export interface PipelineOutput {
  finalText: string;
  changeLog: string;
  beforeAfter: string;
  riskNotes: string;
  exportPack: string;
  exportAvailable: boolean;
  exportReason?: string;
}

export interface ScopeOption {
  id: string;
  label: string;
}

export const PIPELINE_STEPS: Omit<PipelineStep, 'status' | 'progress'>[] = [
  {
    id: 1,
    stage: 'manuscript_ingest',
    label: 'Manuscript Ingest',
    detail: 'Parsing local markdown trees and manuscript nodes...',
  },
  {
    id: 2,
    stage: 'structural_vector_mapping',
    label: 'Structural Vector Mapping',
    detail: 'Aligning plot beats, scene function, and timeline pressure...',
  },
  {
    id: 3,
    stage: 'scene_function_analysis',
    label: 'Scene Function Analysis',
    detail: 'Checking whether each scene earns its place...',
  },
  {
    id: 4,
    stage: 'prose_quality_pass',
    label: 'Prose Quality Pass',
    detail: 'Analysing syntax variance, cadence, filler, and dead phrasing...',
  },
  {
    id: 5,
    stage: 'voice_consistency_calibration',
    label: 'Voice Consistency Calibration',
    detail: 'Testing character register, diction, and emotional vocabulary...',
  },
  {
    id: 6,
    stage: 'dialogue_veracity_audit',
    label: 'Dialogue Veracity Audit',
    detail: 'Checking subtext, conflict, interruption, and natural pressure...',
  },
  {
    id: 7,
    stage: 'subtext_motif_detection',
    label: 'Subtext & Motif Detection',
    detail: 'Mapping recurring images, symbolic load, and buried meaning...',
  },
  {
    id: 8,
    stage: 'sensory_detail_expansion',
    label: 'Sensory Detail Expansion',
    detail: 'Locating scenes that need physical anchoring without purple fog...',
  },
  {
    id: 9,
    stage: 'pacing_tension_mapping',
    label: 'Pacing & Tension Mapping',
    detail: 'Calculating scene velocity, compression, and escalation drag...',
  },
  {
    id: 10,
    stage: 'lexical_density_sweep',
    label: 'Lexical Density Sweep',
    detail: 'Reducing repetition while protecting intentional verbal motifs...',
  },
  {
    id: 11,
    stage: 'micro_tension_polish',
    label: 'Micro-Tension Polish',
    detail: 'Sharpening sentence hooks, transitions, and line endings...',
  },
  {
    id: 12,
    stage: 'final_gold_framework',
    label: 'Final Gold Framework',
    detail: 'Compiling final text, audit report, before/after pairs, and export pack...',
  },
];

export const createInitialSteps = (): PipelineStep[] =>
  PIPELINE_STEPS.map((step) => ({ ...step, status: 'pending', progress: 0 }));

export const passDepthOptions: Array<{ id: NonNullable<PassDepth>; label: string; desc: string }> = [
  { id: 'surface', label: 'Surface Polish', desc: 'Clean prose, light touch' },
  { id: 'structural', label: 'Structural Gold', desc: 'Full editorial sweep' },
  { id: 'deep', label: 'Deep Synthesis', desc: 'Heavy literary mastering' },
];

export const biasOptions = [
  { id: 'literary', label: 'More Literary' },
  { id: 'commercial', label: 'More Commercial' },
  { id: 'darker', label: 'Darker' },
  { id: 'funnier', label: 'Funnier' },
  { id: 'cleaner', label: 'Cleaner' },
  { id: 'rawer', label: 'Keep It Raw' },
];

export const routeOptions: Array<{ id: NonNullable<ModelRoute>; label: string; desc: string }> = [
  { id: 'local', label: 'Local LLM', desc: 'Ollama / private' },
  { id: 'hybrid', label: 'Hybrid', desc: 'Local first, cloud assist' },
  { id: 'cloud', label: 'Cloud Assist', desc: 'Highest reasoning route' },
  { id: 'manual', label: 'Manual Review', desc: 'Diagnostics only' },
];

export const runModeOptions: Array<{ id: NonNullable<RunMode>; label: string; desc: string }> = [
  { id: 'suggestion', label: 'Suggestion Mode', desc: 'No overwrite. Editorial proposals only.' },
  { id: 'controlled', label: 'Controlled Rewrite', desc: 'Rewrite selected scenes with report.' },
  { id: 'full', label: 'Full Gold Pass', desc: 'Whole selected scope. Dangerous magic.' },
];

export function buildOutputFromReport(
  report: GoldReport,
  scopeLabel: string,
  options: GoldRunOptions,
): PipelineOutput {
  const stepLines = report.steps
    .map(
      (s) =>
        `[${s.label.toUpperCase()}]\nStatus: ${s.status} · Score: ${s.score}\n${s.summary}`,
    )
    .join('\n\n');

  const finalText = [
    '// CASPA GOLD ENGINE REPORT',
    `// Report ID: ${report.id}`,
    `// Scope: ${scopeLabel || 'Whole project'}`,
    `// Depth: ${options.depth ?? 'structural'} · Route: ${options.route ?? 'hybrid'} · Mode: ${options.runMode ?? 'controlled'}`,
    `// Overall: ${report.overallScore} — ${report.overallStatus.replace(/_/g, ' ')}`,
    `// Completed: ${new Date(report.completedAt).toLocaleString()}`,
    '',
    stepLines,
    '',
    report.recommendations.length > 0
      ? `[RECOMMENDATIONS]\n${report.recommendations.map((r) => `• ${r}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const changeLog = [
    'CHANGE LOG',
    '',
    ...report.recommendations.map((r, i) => `${i + 1}. ${r}`),
    ...(report.recommendations.length === 0
      ? report.steps.map((s, i) => `${i + 1}. ${s.label}: ${s.summary}`)
      : []),
  ].join('\n');

  const beforeAfter = report.steps
    .map(
      (s) =>
        `STEP: ${s.label}\nSTATUS: ${s.status}\nSCORE: ${s.score}\nSUMMARY: ${s.summary}\nCOMPLETED: ${new Date(s.completedAt).toLocaleString()}`,
    )
    .join('\n\n---\n\n');

  const riskSteps = report.steps.filter(
    (s) => s.status === 'BLOCK' || s.status === 'REVISE' || s.status === 'PASS_WITH_WARNINGS',
  );

  const riskNotes = [
    'RISK NOTES',
    '',
    ...(report.blockers.length > 0
      ? ['[BLOCKERS]', ...report.blockers.map((b) => `• ${b}`), '']
      : []),
    ...(riskSteps.length > 0
      ? [
          '[WARNINGS]',
          ...riskSteps.map((s) => `• ${s.label} (${s.status}): ${s.summary}`),
          '',
        ]
      : []),
    report.overallStatus === 'PASS'
      ? '[STATUS]\nNo critical blockers detected. Human review still recommended before overwrite.'
      : '[STATUS]\nReview flagged items before accepting pipeline output.',
  ].join('\n');

  return {
    finalText,
    changeLog,
    beforeAfter,
    riskNotes,
    exportPack: '',
    exportAvailable: false,
    exportReason: 'Backend does not expose a gold export pack path yet',
  };
}

export function applyReportToSteps(steps: PipelineStep[], report: GoldReport): PipelineStep[] {
  return steps.map((step, idx) => {
    const backendStep = report.steps[idx];
    return {
      ...step,
      status: backendStep?.status === 'BLOCK' ? 'error' : 'done',
      progress: 100,
      detail: backendStep?.summary ?? step.detail,
    };
  });
}

export function applyStepUpdate(
  steps: PipelineStep[],
  event: PipelineRunEvent,
): PipelineStep[] {
  const stageIdx = steps.findIndex((s) => s.stage === event.stage);
  if (stageIdx === -1) return steps;

  return steps.map((step, idx) => {
    if (idx < stageIdx) return { ...step, status: 'done', progress: 100 };
    if (idx === stageIdx) {
      return {
        ...step,
        status: event.status,
        progress: event.progress,
        detail: event.message || step.detail,
      };
    }
    return { ...step, status: 'pending', progress: 0 };
  });
}
