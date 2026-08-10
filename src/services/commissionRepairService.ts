import fs from 'fs';
import path from 'path';
import type { Chapter } from '../types';
import { createJob, getJob, listRecentJobs, updateJob } from './jobQueueService';
import { runServerCommission, type ServerCommissionPayload } from './serverCommissionJobService';

export interface RepairOverrides {
  title?: string;
  idea?: string;
  tone?: string;
  audience?: string;
  targetWordCount?: number;
}

const DEFAULT_REPAIR_ID = '0420dfe9-2899-491f-80ca-399369daddac';

function repairContract(): string {
  return [
    'Repair the existing manuscript rather than commissioning a replacement.',
    'Preserve useful unique substance, but remove duplicated chapter ownership, repeated frameworks and padding.',
    'Make the guide accessible, plain-English, sex-positive, non-judgemental and useful to readers who continue chemsex, reduce it, pause it or stop.',
    'Do not moralise about sex, drugs, HIV, relapse, recovery, relationship structures or reader choices. Distinguish risk from morality.',
    'For clinical, pharmacological, legal and statistical claims, verify current high-quality sources and use Harvard-style author-date references. Remove anything unverifiable.',
    'Never leave dummy phone numbers, fake organisations, [CITATION NEEDED], TODOs or production placeholders.',
    'Do not provide unsupported dosing, tapering or treatment instructions. Never imply naloxone treats non-opioid toxicity.',
    'Create a deliberate visual programme: use [FIGURE: ...], [ILLUSTRATION: ...], [FLOWCHART: ...], [TABLE: ...] and [BOX: ...] where a visual genuinely teaches better than prose. Every marker must include a useful production brief.',
    'Use one canonical Chemsex Dashboard only; reconcile conflicting scoring systems and cross-reference it elsewhere rather than recreating it.',
    'Structure first, prose second. Keep the book coherent and cumulative, not a collection of essays.',
  ].join(' ');
}

function sourceChapters(sourceJobId: string): { chapters: Chapter[]; targetWords: number; promises: any[] } {
  const source = getJob(sourceJobId);
  if (!source) throw new Error(`Source Commission job ${sourceJobId} was not found.`);
  if (source.type !== 'commission' || source.status !== 'complete') throw new Error('Repair source must be a completed Commission job.');
  const result = source.result as any;
  const chapters = Array.isArray(result?.chapters) ? result.chapters as Chapter[] : [];
  if (!chapters.length) throw new Error('Completed Commission job has no retained chapter structure to repair.');
  return {
    chapters: [...chapters].sort((a, b) => a.order - b.order),
    targetWords: Number(result?.targetWords) > 0 ? Number(result.targetWords) : 50000,
    promises: Array.isArray(result?.promises) ? result.promises : [],
  };
}

export function queueRepairFromCompletedJob(sourceJobId: string, overrides: RepairOverrides = {}): string {
  const existing = listRecentJobs(100).find((job) => {
    const input = job.input as any;
    return job.type === 'commission' && input?.repairSourceJobId === sourceJobId && (job.status === 'queued' || job.status === 'running');
  });
  if (existing) return existing.id;

  const source = sourceChapters(sourceJobId);
  const job = createJob('commission', 'repair-queued');
  const target = overrides.targetWordCount && overrides.targetWordCount > 0 ? Math.round(overrides.targetWordCount) : source.targetWords;
  const idea = `${overrides.idea?.trim() || 'Turn the recovered chemsex manuscript into a publication-ready, evidence-aware subject-matter guide.'} ${repairContract()}`;

  const payload: ServerCommissionPayload & { repairSourceJobId: string; repairOnly: true } = {
    repairSourceJobId: sourceJobId,
    repairOnly: true,
    brief: {
      title: overrides.title?.trim() || 'Recovered manuscript — repaired edition',
      mode: 'nonfiction',
      idea,
      tone: overrides.tone?.trim() || 'Accessible, humane, precise and non-judgemental',
      output: 'Publication-ready illustrated nonfiction guide',
      audience: overrides.audience?.trim() || 'Gay, bisexual and other men who have sex with men; partners; clinicians; support workers; interested general readers',
      targetWordCount: target,
    },
    chapters: source.chapters,
    diagnosis: {
      inputType: 'manuscript',
      suggestRebuild: false,
      summary: 'Repair-only recovery of a completed manuscript.',
      recommendations: [{
        id: 'repair-publication-gate',
        title: 'Publication repair',
        detail: repairContract(),
        severity: 'major',
        defaultSelected: true,
        actionType: 'rewrite',
      }],
    } as any,
    selectedRecommendationIds: ['repair-publication-gate'],
    scope: { type: 'whole' },
    autoResearch: true,
    promises: source.promises,
  };

  // All chapters already exist. The checkpoint deliberately skips fresh drafting,
  // then runs only targeted length recovery plus the hardened book-level QA gate.
  updateJob(job.id, {
    status: 'queued',
    progress: 78,
    stage: `repair-queued:${source.chapters.reduce((n, c) => n + String(c.content || '').trim().split(/\s+/).filter(Boolean).length, 0)}/${target}-words`,
    input: payload as any,
    checkpoint: {
      chapters: source.chapters,
      completedOrders: source.chapters.map((c) => c.order),
      phase: 'repair-only',
    } as any,
  });

  setTimeout(() => void runServerCommission(job.id), 0);
  return job.id;
}

export function ensureOneShotRecoveredBookRepair(): string | null {
  const sourceJobId = process.env.CASPA_RECOVERED_BOOK_JOB_ID || DEFAULT_REPAIR_ID;
  const dataDir = process.env.CASPA_DATA_DIR || path.join(process.cwd(), 'data');
  const marker = path.join(dataDir, `.repair-${sourceJobId}.json`);

  try {
    fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(marker)) {
      const saved = JSON.parse(fs.readFileSync(marker, 'utf8'));
      if (saved?.jobId && getJob(String(saved.jobId))) return String(saved.jobId);
      return null;
    }

    const jobId = queueRepairFromCompletedJob(sourceJobId);
    fs.writeFileSync(marker, JSON.stringify({ sourceJobId, jobId, startedAt: new Date().toISOString() }, null, 2));
    return jobId;
  } catch (error) {
    console.error('[commission-repair] one-shot repair not started:', error instanceof Error ? error.message : error);
    return null;
  }
}
