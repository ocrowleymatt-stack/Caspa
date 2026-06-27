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

const TEXT_FALLBACK_KEYS = [
  'text',
  'content',
  'revisedText',
  'finalText',
  'finalProse',
  'improvedRewrite',
  'rewrite',
  'firstDraft',
  'output',
  'result',
  'draft',
  'report',
] as const;

export function countOutputWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function outputExcerpt(text: string, limit = 220): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

function stringField(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function buildStructuredReadableSummary(metadata: Record<string, unknown>): string {
  const kind = typeof metadata.kind === 'string' ? metadata.kind : '';

  if (kind === 'manuscript-structure-report' || Array.isArray(metadata.units)) {
    const units = metadata.units as Array<{ title?: string; type?: string }> | undefined;
    const count = units?.length ?? 0;
    const detected = metadata.detectedType ?? metadata.detectedWorkType ?? 'work';
    const confidence = metadata.confidence ?? 'unknown';
    const titles = units?.slice(0, 8).map((u) => u.title).filter(Boolean).join(', ');
    return `Structure report: ${count} detected ${detected} units (${confidence} confidence).${titles ? `\n${titles}${count > 8 ? '…' : ''}` : ''}`;
  }

  const consensus = metadata.consensus as { summary?: string; revisionPlan?: string[] } | undefined;
  if (consensus?.summary) return consensus.summary;
  if (consensus?.revisionPlan?.length) {
    return `Agent swarm revision plan:\n${consensus.revisionPlan.map((line) => `• ${line}`).join('\n')}`;
  }

  const bible = metadata.bible as { premise?: string; structure?: string } | undefined;
  if (bible?.premise) {
    return [bible.premise, bible.structure].filter(Boolean).join('\n\n');
  }

  if (metadata.finishRoadmap && Array.isArray(metadata.finishRoadmap)) {
    return `Book Map roadmap:\n${(metadata.finishRoadmap as string[]).slice(0, 6).map((l) => `• ${l}`).join('\n')}`;
  }

  const synthesis = metadata.synthesis as { judgeAssessment?: string; revisionPlan?: string[] } | undefined;
  if (synthesis?.judgeAssessment) return synthesis.judgeAssessment;
  if (synthesis?.revisionPlan?.length) {
    return synthesis.revisionPlan.map((line) => `• ${line}`).join('\n');
  }

  if (typeof metadata.critique === 'string' && metadata.critique.trim()) {
    return metadata.critique.trim();
  }

  if (typeof metadata.verdict === 'string') return metadata.verdict.trim();

  return '';
}

/** Extract readable body text from metadata using canonical + fallback keys. */
export function extractOutputText(metadata?: Record<string, unknown>): string {
  if (!metadata) return '';

  for (const key of TEXT_FALLBACK_KEYS) {
    const value = stringField(metadata[key]);
    if (value) return value;
  }

  return buildStructuredReadableSummary(metadata);
}

export function outputHasText(metadata?: Record<string, unknown>): boolean {
  return extractOutputText(metadata).length > 0;
}

const WRITING_OUTPUT_TYPES = new Set([
  'novel-write-pro',
  'continue-writing',
  'gold-pass',
  'manuscript-improvement',
  'pier-boards',
  'pier-stretch',
  'agent-swarm',
  'ask-casper',
]);

/** Normalise metadata at save time — ensures text, hasText, excerpt, wordCount. */
export function normalizeOutputMetadata(
  metadata: Record<string, unknown>,
  opts?: { type?: string; requireText?: boolean },
): Record<string, unknown> {
  const normalised = { ...metadata };
  const existingText = stringField(normalised.text);
  const extracted = existingText || extractOutputText(normalised);

  if (extracted) {
    normalised.text = extracted;
    normalised.content = extracted;
    normalised.hasText = true;
    normalised.wordCount = countOutputWords(extracted);
    normalised.excerpt = outputExcerpt(extracted);
  } else {
    normalised.hasText = false;
    normalised.textRecoverable = Boolean(buildStructuredReadableSummary(normalised));
    if (normalised.textRecoverable) {
      const summary = buildStructuredReadableSummary(normalised);
      normalised.readableSummary = summary;
      normalised.text = summary;
      normalised.content = summary;
      normalised.hasText = true;
      normalised.wordCount = countOutputWords(summary);
      normalised.excerpt = outputExcerpt(summary);
    }
  }

  if (opts?.requireText && opts.type && WRITING_OUTPUT_TYPES.has(opts.type) && !normalised.hasText) {
    throw new Error(`Output type "${opts.type}" requires non-empty text`);
  }

  return normalised;
}

export interface EnrichedOutputListItem {
  id: string;
  projectId?: string;
  type: string;
  title: string;
  path: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  hasText: boolean;
  excerpt: string;
  wordCount: number;
}

export function enrichOutputRecord<T extends { metadata: Record<string, unknown> }>(
  record: T,
): T & { hasText: boolean; excerpt: string; wordCount: number } {
  const meta = normalizeOutputMetadata(record.metadata);
  return {
    ...record,
    metadata: meta,
    hasText: Boolean(meta.hasText),
    excerpt: stringField(meta.excerpt) || outputExcerpt(stringField(meta.text)),
    wordCount: typeof meta.wordCount === 'number' ? meta.wordCount : countOutputWords(stringField(meta.text)),
  };
}
