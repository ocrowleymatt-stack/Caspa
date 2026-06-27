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
  | 'trash-to-treasure'
  | 'book-map'
  | 'finish-book'
  | 'gap-fill-draft'
  | 'next-chapter-draft'
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
  'trash-to-treasure': 'Trash to Treasure',
  'book-map': 'Book Map',
  'finish-book': 'Finish This Book',
  'gap-fill-draft': 'Gap fill draft',
  'next-chapter-draft': 'Next chapter draft',
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
  canAppendToChapter: boolean;
  canSaveAsNewUnit: boolean;
  canExportMarkdown: boolean;
  canOpenWorkbench: boolean;
  isArchiveOnly: boolean;
}

/** Kinds that are metadata/report artefacts — apply actions are disabled by design. */
export const ARCHIVE_ONLY_KINDS = new Set<OutputKind>([
  'book-map',
  'finish-book',
  'imported-source-analysis',
  'pier-survey',
  'structural-pole',
  'agent-swarm-report',
  'claim-extraction',
  'accuracy-check',
  'export-package',
  'project-bible',
]);

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
    'continue-writing': 'continue-writing',
    'plot-continuation': 'plot-continuation',
    'manuscript-improvement': 'manuscript-revision',
    'manuscript-revision': 'manuscript-revision',
    'novel-write-pro': 'novel-write-pro',
    'trash-to-treasure': 'trash-to-treasure',
    'book-map': 'book-map',
    'finish-book': 'finish-book',
    'gap-fill-draft': 'gap-fill-draft',
    'next-chapter-draft': 'next-chapter-draft',
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

export function extractOutputText(metadata?: OutputMetadata | Record<string, unknown>): string {
  if (!metadata) return '';

  const meta = metadata as Record<string, unknown>;
  const keys = [
    'text', 'content', 'revisedText', 'finalText', 'finalProse',
    'improvedRewrite', 'rewrite', 'firstDraft', 'output', 'result', 'draft', 'report',
  ] as const;

  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  const consensus = meta.consensus as { summary?: string; revisionPlan?: string[] } | undefined;
  if (consensus?.summary?.trim()) return consensus.summary.trim();
  if (consensus?.revisionPlan?.length) {
    return consensus.revisionPlan.map((line) => `• ${line}`).join('\n');
  }

  if (typeof meta.critique === 'string' && meta.critique.trim()) return meta.critique.trim();

  const kind = typeof meta.kind === 'string' ? meta.kind : '';
  if (kind === 'claim-extraction' && Array.isArray(meta.claims)) {
    const lines = (meta.claims as Array<{ text?: string }>)
      .slice(0, 20)
      .map((claim) => (typeof claim.text === 'string' ? claim.text.trim() : ''))
      .filter(Boolean)
      .map((line) => `• ${line}`);
    if (lines.length) return `Extracted claims:\n${lines.join('\n')}`;
  }
  if (kind === 'book-map') {
    const arc = typeof meta.arcSummary === 'string' ? meta.arcSummary.trim() : '';
    const missing = Array.isArray(meta.missingSections)
      ? (meta.missingSections as string[]).slice(0, 8).join(', ')
      : '';
    const parts = [arc, missing ? `Missing sections: ${missing}` : ''].filter(Boolean);
    if (parts.length) return parts.join('\n\n');
  }

  return '';
}

export function outputHasText(metadata?: OutputMetadata | Record<string, unknown>): boolean {
  return extractOutputText(metadata).length > 0;
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
  const meta = output.metadata ?? {};
  const sourceChapterId = meta.sourceChapterId ?? meta.chapterId ?? meta.unitId;
  const applyBlocked = Boolean((meta as Record<string, unknown>).applyBlocked ?? (meta as Record<string, unknown>).driftBlocked);
  const hasText = outputHasText(output.metadata);
  const kind = normalizeOutputKind(output.type, meta);
  const isArchiveOnly = ARCHIVE_ONLY_KINDS.has(kind) || Boolean((meta as Record<string, unknown>).unrecoverable);

  return {
    canCopy: hasText,
    canContinue: Boolean(output.projectId && hasText && !applyBlocked && !isArchiveOnly),
    canGoldPass: Boolean(output.projectId && hasText && !isArchiveOnly),
    canApplyToChapter: Boolean(output.projectId && sourceChapterId && hasText && !applyBlocked && !isArchiveOnly),
    canAppendToChapter: Boolean(output.projectId && sourceChapterId && hasText && !applyBlocked && !isArchiveOnly),
    canSaveAsNewUnit: Boolean(output.projectId && hasText && !applyBlocked && !isArchiveOnly),
    canExportMarkdown: Boolean(hasText || output.title),
    canOpenWorkbench: Boolean(output.projectId),
    isArchiveOnly,
  };
}

export function archiveOnlyEmptyMessage(kind: OutputKind): string {
  if (kind === 'book-map') return 'Book Map report — open Book Map to use this structure plan.';
  if (kind === 'finish-book') return 'Finish roadmap — use Book Map or Finish This Book to act on it.';
  if (kind === 'imported-source-analysis') return 'Import analysis — metadata only; re-upload source if needed.';
  if (kind === 'export-package') return 'Export package — download from Export tab.';
  if (kind === 'project-bible') return 'Project Bible snapshot — edit in Bible tab.';
  if (kind === 'agent-swarm-report') return 'Swarm critique report — review notes here or run a revision pass.';
  return 'Archive record — no prose to apply. Rerun the tool to regenerate text.';
}

export function outputExcerpt(text: string, limit = 220): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}
