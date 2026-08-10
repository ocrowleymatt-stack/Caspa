import type { Chapter } from '../types';
import type { CommissionScope, Diagnosis } from '../types/commission';
import type { StoryPromise } from '../types/promise';
import { createJob, getJob, listRecentJobs, updateJob } from './jobQueueService';

export interface ServerCommissionBrief {
  title: string;
  mode: string;
  idea: string;
  tone: string;
  output: string;
  audience: string;
  targetWordCount?: number;
}

export interface ServerCommissionPayload {
  brief: ServerCommissionBrief;
  chapters: Chapter[];
  diagnosis: Diagnosis;
  selectedRecommendationIds: string[];
  scope: CommissionScope;
  autoResearch?: boolean;
  promises?: StoryPromise[];
}

type Checkpoint = {
  chapters: Chapter[];
  completedOrders: number[];
  phase: string;
};

const activeWorkers = new Set<string>();
const RECOVERY_CONCURRENCY = 2;

function countWords(text?: string | null): number {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function totalWords(chapters: Chapter[]): number {
  return chapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0);
}

function targetWords(brief: ServerCommissionBrief): number {
  const supplied = typeof brief.targetWordCount === 'number' && Number.isFinite(brief.targetWordCount) && brief.targetWordCount > 0
    ? Math.round(brief.targetWordCount)
    : 0;
  const mode = (brief.mode || '').toLowerCase();

  if (mode === 'nonfiction') return supplied >= 5000 ? supplied : 50000;
  if (mode === 'novel' || mode === 'adaptation' || mode === 'chaos') return supplied >= 10000 ? supplied : 80000;
  if (mode === 'script') return supplied >= 5000 ? supplied : 20000;
  if (mode === 'musical') return supplied >= 8000 ? supplied : 25000;
  if (mode === 'essay') return supplied || 3000;
  if (mode === 'poetry') return supplied || 800;
  if (mode === 'picture') return supplied || 500;
  return supplied >= 10000 ? supplied : 80000;
}

function isNonfiction(brief: ServerCommissionBrief): boolean {
  return ['nonfiction', 'essay'].includes((brief.mode || '').toLowerCase());
}

function chaptersInScope(chapters: Chapter[], scope: CommissionScope): Chapter[] {
  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  if (scope.type === 'single') return sorted.filter((c) => c.order + 1 === (scope.singleChapter ?? 1));
  if (scope.type === 'chapters') {
    return sorted.filter((c) => c.order + 1 >= (scope.chapterFrom ?? 1) && c.order + 1 <= (scope.chapterTo ?? sorted.length));
  }
  return sorted;
}

function scopeNeedsFullBook(scope: CommissionScope): boolean {
  return scope.type === 'whole' || scope.type === 'rebuild' || scope.type === 'autowrite';
}

function nonfictionContract(brief: ServerCommissionBrief): string {
  if (!isNonfiction(brief)) return '';
  return `NONFICTION GUIDE CONTRACT — overrides fiction defaults where they conflict:
- Write authoritative, lucid guide/reference material for ${brief.audience || 'the intended reader'}; never novelise the subject.
- Structure first, prose second. Use descriptive headings/subheadings, definitions, explanation, worked examples, practical scenarios, checklists, decision aids, tables, boxes, summaries and takeaways when useful.
- Distinguish fact, interpretation, professional judgement, lived experience and speculation.
- Never invent citations, studies, statistics, organisations, quotations, dates or authorities. If evidence is unavailable, write [CITATION NEEDED].
- When web research supplies trustworthy provenance, use Harvard-style author-date citations and enough bibliographic detail to assemble a reference list.
- Expand by adding substance, evidence, explanation, examples and reader utility — never padding or repeated paraphrase.
- Mark genuinely useful visual opportunities inline as [FIGURE: ...], [TABLE: ...] or [BOX: ...].
- Maintain one coherent book with cumulative learning and cross-chapter continuity, not a bundle of essays.`;
}

async function callAi(prompt: string, maxTokens: number, useWebSearch = false): Promise<string> {
  const port = Number(process.env.PORT) || 3000;
  const response = await fetch(`http://127.0.0.1:${port}/api/ai/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      maxTokens,
      intelligenceMode: 'balanced',
      taskHint: 'longform',
      useWebSearch,
      skipLocalFallback: true,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.result) throw new Error(data?.message || `AI worker failed (${response.status})`);
  return String(data.result).trim();
}

async function callAiWithRetry(prompt: string, maxTokens: number, useWebSearch = false, attempts = 3): Promise<string> {
  let last: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await callAi(prompt, maxTokens, useWebSearch);
    } catch (error) {
      last = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
    }
  }
  throw last instanceof Error ? last : new Error('AI worker failed after retries');
}

function selectedDirectives(payload: ServerCommissionPayload): string[] {
  return payload.diagnosis.recommendations
    .filter((r) => payload.selectedRecommendationIds.includes(r.id))
    .map((r) => `${r.title}: ${r.detail}`);
}

function continuityBefore(chapters: Chapter[], order: number): string {
  return chapters
    .filter((c) => c.order < order)
    .sort((a, b) => a.order - b.order)
    .map((c) => `## ${c.title}\n${c.content || c.summary}`)
    .join('\n\n')
    .slice(-14000);
}

function chapterPrompt(payload: ServerCommissionPayload, working: Chapter[], chapter: Chapter, chapterTarget: number): string {
  const brief = payload.brief;
  const directives = selectedDirectives(payload);
  const promiseLines = (payload.promises || []).filter((p) => p.status !== 'paid_off').map((p) => `- ${p.statement} (${p.status})`);
  const existing = chapter.content?.trim() || '';

  return `You are Caspa's senior ${isNonfiction(brief) ? 'nonfiction commissioning editor and subject-guide writer' : 'book writer and editor'}.

BOOK: ${brief.title || 'Untitled'}
MODE: ${brief.mode}
AUDIENCE: ${brief.audience || 'General reader'}
TONE: ${brief.tone || 'Clear and controlled'}
BOOK PURPOSE / PREMISE: ${brief.idea || ''}
FULL BOOK TARGET: ${targetWords(brief).toLocaleString()} words
THIS CHAPTER TARGET: ${chapterTarget.toLocaleString()} words. Acceptable range ${Math.round(chapterTarget * 0.92).toLocaleString()}–${Math.round(chapterTarget * 1.08).toLocaleString()} words.

${nonfictionContract(brief)}

CHAPTER ${chapter.order + 1}: ${chapter.title}
CHAPTER PURPOSE: ${chapter.summary || ''}
${existing ? `EXISTING CHAPTER TO IMPROVE:\n${existing.slice(0, 50000)}\n` : ''}
APPROVED FIXES:
${directives.length ? directives.map((d) => `- ${d}`).join('\n') : '- Complete the chapter to professional publication standard.'}
${promiseLines.length ? `\nREADER/STORY PROMISES TO HONOUR:\n${promiseLines.join('\n')}` : ''}

CONTINUITY FROM EARLIER CHAPTERS:
${continuityBefore(working, chapter.order) || '[First chapter]'}

RULES:
- The target word count is a production requirement, not a suggestion.
- Output the finished chapter only; no task notes or word-count commentary.
- Preserve continuity and do not reintroduce the whole book at every chapter.
- Do not use filler to reach length. Add missing substance instead.
- Never silently abandon an approved fix or promised topic.
- Use Markdown headings only where appropriate to this book type.`;
}

function expansionPrompt(payload: ServerCommissionPayload, working: Chapter[], chapter: Chapter, addWords: number): string {
  const brief = payload.brief;
  const existing = chapter.content?.trim() || '';
  const directives = selectedDirectives(payload);
  const targetAdd = Math.max(350, Math.round(addWords));

  return `You are extending one chapter of a nearly finished ${brief.mode} book. This is a targeted additive recovery pass, not a rewrite.

BOOK: ${brief.title || 'Untitled'}
AUDIENCE: ${brief.audience || 'General reader'}
TONE: ${brief.tone || 'Clear and controlled'}
BOOK PURPOSE: ${brief.idea || ''}
${nonfictionContract(brief)}

CHAPTER ${chapter.order + 1}: ${chapter.title}
CHAPTER PURPOSE: ${chapter.summary || ''}
CURRENT CHAPTER (${countWords(existing).toLocaleString()} words):
${existing.slice(0, 52000)}

APPROVED FIXES:
${directives.length ? directives.map((d) => `- ${d}`).join('\n') : '- Complete the chapter to professional publication standard.'}

ADD APPROXIMATELY ${targetAdd.toLocaleString()} NEW WORDS OF GENUINELY USEFUL MATERIAL.
- Return ONLY the new material to append, not the original chapter.
- Do not repeat, recap or paraphrase material already present.
- Prefer missing explanation, practical detail, worked examples, distinctions, cautions, decision aids, evidence-aware context, tables/boxes/figures, and reader questions that materially improve this chapter.
- Do not invent evidence or citations. Use [CITATION NEEDED] where provenance is unavailable.
- Make the addition read as a natural continuation of this chapter, with headings only when useful.
- Aim for ${Math.round(targetAdd * 0.95).toLocaleString()}–${Math.round(targetAdd * 1.15).toLocaleString()} new words.

EARLIER-BOOK CONTINUITY:
${continuityBefore(working, chapter.order) || '[First chapter]'}`;
}

async function rebuildArchitecture(payload: ServerCommissionPayload, chapters: Chapter[]): Promise<Chapter[]> {
  const target = targetWords(payload.brief);
  const source = chapters.map((c) => `# ${c.title}\n${c.summary}\n${c.content}`).join('\n\n').slice(0, 90000);
  const prompt = `Rebuild the architecture of this ${payload.brief.mode} book into a coherent chapter plan capable of supporting ${target.toLocaleString()} finished words.
Return JSON only: {"chapters":[{"title":"...","summary":"specific chapter purpose and coverage"}]}.
Preserve valuable source material and all important reader promises. Avoid essay-bundle structure. Aim for enough chapters to give each chapter a practical 2,000–4,500 word allocation where appropriate.

BOOK PURPOSE: ${payload.brief.idea}
SOURCE:\n${source}`;
  const text = await callAiWithRetry(prompt, 6000, false);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Rebuild architecture returned no usable JSON');
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed.chapters) || !parsed.chapters.length) throw new Error('Rebuild architecture returned no chapters');
  return parsed.chapters.map((c: any, index: number) => ({
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    title: String(c.title || `Chapter ${index + 1}`),
    summary: String(c.summary || ''),
    content: '',
    order: index,
    plotNodeIds: [],
    tags: ['server-rebuilt'],
    isPlan: true,
    directives: [],
    updatedAt: Date.now(),
    wordCount: 0,
  } as Chapter));
}

export function queueServerCommission(payload: ServerCommissionPayload): string {
  const job = createJob('commission', 'queued');
  updateJob(job.id, { status: 'queued', progress: 0, stage: 'queued', input: payload as any });
  setTimeout(() => void runServerCommission(job.id), 0);
  return job.id;
}

export async function runServerCommission(jobId: string): Promise<void> {
  if (activeWorkers.has(jobId)) return;
  const job = getJob(jobId);
  if (!job || job.type !== 'commission' || !job.input) return;
  activeWorkers.add(jobId);

  try {
    const payload = job.input as unknown as ServerCommissionPayload;
    const existingCheckpoint = job.checkpoint as unknown as Checkpoint | undefined;
    let working = existingCheckpoint?.chapters?.length ? existingCheckpoint.chapters : [...payload.chapters].sort((a, b) => a.order - b.order);
    const completedOrders = new Set<number>(existingCheckpoint?.completedOrders || []);

    updateJob(jobId, { status: 'running', stage: existingCheckpoint ? 'resuming' : 'starting', progress: Math.max(job.progress || 0, 2), error: undefined });

    if (!existingCheckpoint && (payload.scope.type === 'rebuild' || payload.diagnosis.recommendations.some((r) => payload.selectedRecommendationIds.includes(r.id) && r.actionType === 'rebuild'))) {
      updateJob(jobId, { stage: 'rebuilding', progress: 6 });
      working = await rebuildArchitecture(payload, working);
      updateJob(jobId, { checkpoint: { chapters: working, completedOrders: [], phase: 'rebuilding' } as any, stage: 'rebuilding', progress: 12 });
    }

    const fullTarget = targetWords(payload.brief);
    const chapterTarget = Math.max(600, Math.round(fullTarget / Math.max(1, working.length)));
    const scoped = chaptersInScope(working, payload.scope);
    const targets = scoped.filter((c) => !completedOrders.has(c.order));

    for (let index = 0; index < targets.length; index += 1) {
      const chapter = targets[index];
      const pct = 15 + Math.round(((index + 1) / Math.max(1, targets.length)) * 62);
      updateJob(jobId, { status: 'running', stage: `writing:${chapter.order + 1}:${chapter.title}`, progress: pct });
      const prompt = chapterPrompt(payload, working, chapter, chapterTarget);
      const maxTokens = Math.min(16000, Math.max(2500, Math.ceil(chapterTarget * 1.65)));
      const content = await callAiWithRetry(prompt, maxTokens, Boolean(payload.autoResearch && isNonfiction(payload.brief)));
      working = working.map((c) => c.order === chapter.order ? {
        ...c,
        content,
        isPlan: false,
        wordCount: countWords(content),
        updatedAt: Date.now(),
      } : c);
      completedOrders.add(chapter.order);
      updateJob(jobId, {
        checkpoint: { chapters: working, completedOrders: [...completedOrders], phase: 'draft' } as any,
        stage: `checkpoint:${chapter.order + 1}`,
        progress: pct,
      });
    }

    if (scopeNeedsFullBook(payload.scope)) {
      const minWords = Math.round(fullTarget * 0.95);
      const recoveryGoal = fullTarget;

      for (let pass = 1; pass <= 3 && totalWords(working) < minWords; pass += 1) {
        const current = totalWords(working);
        const remaining = Math.max(0, recoveryGoal - current);
        updateJob(jobId, { stage: `length-audit:${pass}:${current}`, progress: 80 + pass * 4 });

        const ranked = [...working]
          .map((chapter) => ({ chapter, deficit: Math.max(0, chapterTarget - countWords(chapter.content)) }))
          .sort((a, b) => b.deficit - a.deficit || countWords(a.chapter.content) - countWords(b.chapter.content));
        if (!ranked.length || remaining <= 0) break;

        const candidates = ranked.slice(0, Math.min(6, ranked.length));
        const share = Math.max(450, Math.ceil((remaining * 1.08) / Math.min(candidates.length, 4)));

        for (let i = 0; i < candidates.length && totalWords(working) < minWords; i += RECOVERY_CONCURRENCY) {
          const batch = candidates.slice(i, i + RECOVERY_CONCURRENCY);
          const snapshot = working;
          updateJob(jobId, {
            stage: `length-recovery:${pass}:${totalWords(working)}:${Math.min(i + batch.length, candidates.length)}/${candidates.length}`,
            progress: Math.min(95, 83 + pass * 3 + Math.round(((i + batch.length) / candidates.length) * 3)),
          });

          const additions = await Promise.all(batch.map(async ({ chapter, deficit }) => {
            const stillNeeded = Math.max(350, recoveryGoal - totalWords(snapshot));
            const addWords = Math.min(Math.max(share, deficit), Math.max(650, Math.ceil(stillNeeded / Math.max(1, batch.length))));
            const prompt = expansionPrompt(payload, snapshot, chapter, addWords);
            const maxTokens = Math.min(8000, Math.max(1400, Math.ceil(addWords * 1.65)));
            const addition = await callAiWithRetry(prompt, maxTokens, false, 2);
            return { order: chapter.order, addition };
          }));

          for (const { order, addition } of additions) {
            working = working.map((c) => c.order === order ? {
              ...c,
              content: `${c.content?.trim() || ''}\n\n${addition.trim()}`.trim(),
              isPlan: false,
              wordCount: countWords(`${c.content?.trim() || ''} ${addition}`),
              updatedAt: Date.now(),
            } : c);
          }

          updateJob(jobId, {
            checkpoint: { chapters: working, completedOrders: [...completedOrders], phase: 'length-audit' } as any,
            stage: `length-checkpoint:${pass}:${totalWords(working)}`,
          });
        }
      }

      const finalWords = totalWords(working);
      if (finalWords < minWords) {
        throw new Error(`Book remains under production length after recovery: ${finalWords.toLocaleString()} / ${fullTarget.toLocaleString()} words. Server checkpoint retained for retry.`);
      }
    }

    updateJob(jobId, { stage: 'final-qa', progress: 96 });
    const artefact = [...working]
      .sort((a, b) => a.order - b.order)
      .map((c) => `# ${c.title}\n\n${c.content || ''}`)
      .join('\n\n---\n\n');
    const words = totalWords(working);

    updateJob(jobId, {
      status: 'complete',
      progress: 100,
      stage: 'complete',
      result: { finalText: artefact, artefact, chapters: working, words, targetWords: fullTarget, promises: payload.promises || [] },
      input: undefined,
      checkpoint: undefined,
    });
  } catch (error) {
    updateJob(jobId, {
      status: 'failed',
      stage: 'failed',
      error: error instanceof Error ? error.message : 'Server commission failed',
    });
  } finally {
    activeWorkers.delete(jobId);
  }
}

export function resumePersistedCommissionJobs(): void {
  for (const job of listRecentJobs(100)) {
    if (job.type === 'commission' && (job.status === 'queued' || job.status === 'running') && job.input) {
      setTimeout(() => void runServerCommission(job.id), 100);
    }
  }
}
