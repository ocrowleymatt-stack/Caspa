import { workTypeLabel, type WorkType } from './workModel';

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

export interface OutputMetadata {
  text?: string;
  critique?: string;
  kind?: string;
  provider?: string;
  model?: string;
  sourceChapterId?: string;
  sourceChapterTitle?: string;
  chapterId?: string;
  improvementMode?: string;
  improveExisting?: boolean;
  workType?: string;
  sourceScope?: string;
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
  mode?: string;
  revisedText?: string;
  awardFit?: Array<{ awardName?: string; awardId?: string }>;
  synthesis?: {
    sourcesUsed?: Record<string, boolean>;
    disclaimer?: string;
  };
  disclaimer?: string;
}

export interface OutputRecord {
  id: string;
  projectId?: string;
  type: string;
  title: string;
  metadata?: OutputMetadata;
  createdAt: string;
}

export interface OutputProvenanceView {
  kind: OutputKind;
  kindLabel: string;
  workTypeLabel?: string;
  sourceLabel?: string;
  unitLabel?: string;
  researchLabel?: string;
  awardsLabel?: string;
  swarmLabel?: string;
  providerLabel?: string;
  stageLabel?: string;
}

export interface OutputApplyCapabilities {
  canCopy: boolean;
  canContinue: boolean;
  canGoldPass: boolean;
  canApplyToChapter: boolean;
  canExportMarkdown: boolean;
  canOpenWorkbench: boolean;
}

export function normalizeOutputKind(type: string, metadata?: OutputMetadata): OutputKind {
  const kind = metadata?.kind ?? type;

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
    'agent-swarm': metadata?.revisedText ? 'agent-swarm-revision' : 'agent-swarm-report',
    'agent-swarm-report': 'agent-swarm-report',
    'agent-swarm-revision': 'agent-swarm-revision',
    'award-assessment': 'award-assessment',
    'gold-pass': 'gold-pass',
    'gold-synthesis': 'gold-pass',
    'project-bible': 'project-bible',
    'export-package': 'export-package',
  };

  return map[kind] ?? map[type] ?? 'other';
}

export function extractOutputText(metadata?: OutputMetadata): string {
  if (!metadata) return '';
  return (
    metadata.text?.trim()
    || metadata.revisedText?.trim()
    || ''
  );
}

export function extractOutputProvenance(
  output: OutputRecord,
  projectWorkType?: WorkType,
): OutputProvenanceView {
  const meta = output.metadata ?? {};
  const kind = normalizeOutputKind(output.type, meta);
  const workType = meta.workType ?? projectWorkType;

  const sourceParts: string[] = [];
  if (meta.sourceChapterTitle) {
    sourceParts.push(`Chapter: ${meta.sourceChapterTitle}`);
  } else if (meta.sourceScope) {
    sourceParts.push(meta.sourceScope.replace(/-/g, ' '));
  }

  const unitParts: string[] = [];
  if (meta.unitTitle) unitParts.push(meta.unitTitle);
  else if (meta.unitId) unitParts.push(meta.unitId.slice(0, 8));
  if (meta.fromPoleTitle && meta.toPoleTitle) {
    unitParts.push(`${meta.fromPoleTitle} → ${meta.toPoleTitle}`);
  }

  const researchLabels = meta.researchUsedLabels?.length
    ? meta.researchUsedLabels
    : meta.researchItemIds?.map((id) => id.slice(0, 8));

  const awardLabels = meta.awardTargetLabels?.length
    ? meta.awardTargetLabels
    : meta.awardFit?.map((item) => item.awardName ?? item.awardId ?? '').filter(Boolean)
    ?? meta.targetAwardIds?.map((id) => id.slice(0, 8));

  return {
    kind,
    kindLabel: OUTPUT_KIND_LABELS[kind],
    workTypeLabel: workType ? workTypeLabel(workType as WorkType) : undefined,
    sourceLabel: sourceParts.join(' · ') || undefined,
    unitLabel: unitParts.join(' · ') || undefined,
    researchLabel: researchLabels?.length ? researchLabels.join(', ') : undefined,
    awardsLabel: awardLabels?.length ? awardLabels.join(' · ') : undefined,
    swarmLabel: meta.swarmId
      ? `Swarm ${meta.swarmId.slice(0, 8)}`
      : meta.swarmOutputId
        ? `Swarm output ${meta.swarmOutputId.slice(0, 8)}`
        : undefined,
    providerLabel: meta.provider
      ? `${meta.provider}/${meta.model ?? 'model'}`
      : undefined,
    stageLabel: meta.stage ?? meta.mode,
  };
}

export function getApplyCapabilities(output: OutputRecord): OutputApplyCapabilities {
  const text = extractOutputText(output.metadata);
  const meta = output.metadata ?? {};
  const sourceChapterId = meta.sourceChapterId ?? meta.chapterId;

  return {
    canCopy: Boolean(text),
    canContinue: Boolean(output.projectId && text),
    canGoldPass: Boolean(output.projectId && text),
    canApplyToChapter: Boolean(output.projectId && sourceChapterId && text),
    canExportMarkdown: Boolean(text || output.title),
    canOpenWorkbench: Boolean(output.projectId),
  };
}

export function outputExcerpt(text: string, limit = 220): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}
