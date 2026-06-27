import type { WorkType } from './workModel';

/** Canonical output kinds — creative archive taxonomy. */
export type OutputKind =
  | 'imported-source-analysis'
  | 'pier-survey'
  | 'structural-pole'
  | 'decking-draft'
  | 'stretched-decking'
  | 'plot-continuation'
  | 'manuscript-revision'
  | 'research-answer'
  | 'research-depth-pass'
  | 'accuracy-check'
  | 'claim-extraction'
  | 'agent-swarm-report'
  | 'agent-swarm-revision'
  | 'award-assessment'
  | 'gold-pass'
  | 'project-bible'
  | 'export-package'
  | 'novel-write-pro'
  | 'continue-writing'
  | 'other';

export const OUTPUT_KIND_LABELS: Record<OutputKind, string> = {
  'imported-source-analysis': 'Import analysis',
  'pier-survey': 'Pier survey',
  'structural-pole': 'Structural pole',
  'decking-draft': 'Decking draft',
  'stretched-decking': 'Stretched decking',
  'plot-continuation': 'Plot continuation',
  'manuscript-revision': 'Manuscript revision',
  'research-answer': 'Research answer',
  'research-depth-pass': 'Research depth pass',
  'accuracy-check': 'Accuracy check',
  'claim-extraction': 'Claim extraction',
  'agent-swarm-report': 'Agent swarm report',
  'agent-swarm-revision': 'Agent swarm revision',
  'award-assessment': 'Award assessment',
  'gold-pass': 'Gold pass',
  'project-bible': 'Project Bible',
  'export-package': 'Export package',
  'novel-write-pro': 'Novel Write Pro draft',
  'continue-writing': 'Continue writing',
  other: 'Output',
};

export interface OutputProvenanceFields {
  workType?: WorkType | string;
  sourceScope?: string;
  sourceChapterId?: string;
  sourceChapterTitle?: string;
  unitId?: string;
  unitTitle?: string;
  fromPoleTitle?: string;
  toPoleTitle?: string;
  researchItemIds?: string[];
  researchUsedLabels?: string[];
  targetAwardIds?: string[];
  awardTargetLabels?: string[];
  swarmOutputId?: string;
  swarmId?: string;
  stage?: string;
  provider?: string;
  model?: string;
}

export function standardOutputProvenance(
  fields: OutputProvenanceFields,
): Record<string, unknown> {
  return {
    workType: fields.workType,
    sourceScope: fields.sourceScope,
    sourceChapterId: fields.sourceChapterId,
    sourceChapterTitle: fields.sourceChapterTitle,
    unitId: fields.unitId,
    unitTitle: fields.unitTitle,
    fromPoleTitle: fields.fromPoleTitle,
    toPoleTitle: fields.toPoleTitle,
    researchItemIds: fields.researchItemIds,
    researchUsedLabels: fields.researchUsedLabels,
    targetAwardIds: fields.targetAwardIds,
    awardTargetLabels: fields.awardTargetLabels,
    swarmOutputId: fields.swarmOutputId,
    swarmId: fields.swarmId,
    stage: fields.stage,
    provider: fields.provider,
    model: fields.model,
  };
}

export function normalizeOutputKind(
  type: string,
  metadata?: Record<string, unknown>,
): OutputKind {
  const kind = typeof metadata?.kind === 'string' ? metadata.kind : type;

  const map: Record<string, OutputKind> = {
    'imported-source-analysis': 'imported-source-analysis',
    'pier-survey': 'pier-survey',
    'structural-pole': 'structural-pole',
    'pier-boards': 'decking-draft',
    'decking-draft': 'decking-draft',
    'pier-stretch': 'stretched-decking',
    'stretched-decking': 'stretched-decking',
    'continue-writing': 'plot-continuation',
    'plot-continuation': 'plot-continuation',
    'manuscript-improvement': 'manuscript-revision',
    'manuscript-revision': 'manuscript-revision',
    'novel-write-pro': 'novel-write-pro',
    'research-answer': 'research-answer',
    'research-depth-pass': 'research-depth-pass',
    'accuracy-check': 'accuracy-check',
    'claim-extraction': 'claim-extraction',
    'agent-swarm': 'agent-swarm-report',
    'agent-swarm-report': 'agent-swarm-report',
    'agent-swarm-revision': 'agent-swarm-revision',
    'award-assessment': 'award-assessment',
    'gold-pass': 'gold-pass',
    'gold-synthesis': 'gold-pass',
    'project-bible': 'project-bible',
    'export-package': 'export-package',
  };

  if (kind === 'agent-swarm' && metadata?.revisedText) {
    return 'agent-swarm-revision';
  }

  return map[kind] ?? map[type] ?? 'other';
}

export function outputKindLabel(type: string, metadata?: Record<string, unknown>): string {
  const kind = normalizeOutputKind(type, metadata);
  return OUTPUT_KIND_LABELS[kind];
}

export function extractOutputText(metadata?: Record<string, unknown>): string {
  if (!metadata) return '';
  const text = metadata.text;
  const revised = metadata.revisedText;
  if (typeof text === 'string' && text.trim()) return text.trim();
  if (typeof revised === 'string' && revised.trim()) return revised.trim();
  return '';
}
