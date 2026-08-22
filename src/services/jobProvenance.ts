import { createHash } from 'node:crypto';
import type { CaspaJobRecord } from '../types/gold';

export type JobProvenance = {
  title?: string;
  brief?: string;
  sourceProjectTitle?: string;
  wordCount?: number;
  checksum?: string;
  excerpt?: string;
};

export type JobListRecord = Omit<CaspaJobRecord, 'input' | 'checkpoint' | 'result'> & {
  resultAvailable: boolean;
  resumable: boolean;
  provenance?: JobProvenance;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return String(value || '').trim();
}

export function jobManuscriptPayload(job: Pick<CaspaJobRecord, 'result'>): string {
  const result = asRecord(job.result);
  return text(result.artefact || result.finalText);
}

export function jobProvenance(job: Pick<CaspaJobRecord, 'input' | 'result'> & { provenance?: JobProvenance }): JobProvenance {
  if (job.provenance?.checksum || job.provenance?.title) return job.provenance;
  const input = asRecord(job.input);
  const result = asRecord(job.result);
  const brief = { ...asRecord(result.project), ...asRecord(result.brief), ...asRecord(input.brief) };
  const content = jobManuscriptPayload(job);
  const wordCount = Number(result.words);
  return {
    title: text(brief.title || brief.name) || undefined,
    brief: text(brief.idea || brief.logline || brief.premise || brief.synopsis).slice(0, 240) || undefined,
    sourceProjectTitle: text(brief.title || brief.name) || undefined,
    wordCount: Number.isFinite(wordCount) && wordCount > 0
      ? wordCount
      : content ? content.split(/\s+/).filter(Boolean).length : undefined,
    checksum: content ? createHash('sha256').update(content).digest('hex') : undefined,
    excerpt: content.slice(0, 280) || undefined,
  };
}

export function toJobListRecord(job: CaspaJobRecord & Partial<JobListRecord>): JobListRecord {
  const { input, checkpoint, result, ...summary } = job;
  return {
    ...summary,
    resultAvailable: result !== undefined || job.resultAvailable === true,
    resumable: input !== undefined || checkpoint !== undefined || job.resumable === true,
    provenance: job.provenance || jobProvenance(job),
  };
}
