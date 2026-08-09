/**
 * Caspa Commission Service
 * Diagnose in-browser, then hand long finish work to Atlas so the browser is
 * never the owner of a whole-book job.
 */

import { AIService } from './ai';
import type { Chapter, Project, ProjectType } from '../types';
import type {
  CommissionProgress,
  CommissionScope,
  Diagnosis,
  Recommendation,
  ChapterSummary,
} from '../types/commission';
import type { StoryPromise } from '../types/promise';
import { formatShowPackForWriting } from './showBoxService';

export interface ProjectBriefLike {
  title: string;
  mode: string;
  idea: string;
  tone: string;
  output: string;
  audience: string;
  targetWordCount?: number;
}

const FINISH_FLOOR = 0.95;
const FINISH_CEILING = 1.05;
const ACTIVE_JOB_PREFIX = 'caspa.commission.serverJob:';

function countWords(text: string | undefined | null): number {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function totalWords(chapters: Chapter[]): number {
  return chapters.reduce((sum, c) => sum + countWords(c.content), 0);
}

function isNonfictionBrief(brief: ProjectBriefLike): boolean {
  return ['nonfiction', 'essay'].includes((brief.mode || '').toLowerCase());
}

function briefToProjectType(mode: string): ProjectType {
  if (mode === 'script') return 'stageplay';
  if (mode === 'musical') return 'stageplay';
  if (mode === 'picture') return 'illustrated';
  if (mode === 'nonfiction' || mode === 'essay') return 'academic';
  if (mode === 'poetry') return 'experimental';
  if (mode === 'adaptation') return 'novel';
  return 'novel';
}

function projectKey(brief: ProjectBriefLike): string {
  return `${brief.title || 'untitled'}:${brief.mode || 'book'}`.toLowerCase().replace(/[^a-z0-9:_-]+/g, '-').slice(0, 120);
}

function activeJobKey(brief: ProjectBriefLike): string {
  return `${ACTIVE_JOB_PREFIX}${projectKey(brief)}`;
}

export function briefToProject(brief: ProjectBriefLike): Project {
  return {
    id: 'local-commission',
    title: brief.title,
    type: briefToProjectType(brief.mode),
    maturity: 'standard',
    genre: brief.mode,
    premise: brief.idea,
    tone: brief.tone,
    ownerId: 'local',
    collaborators: [],
    lastModified: Date.now(),
    createdAt: Date.now(),
    targetWordCount:
      typeof brief.targetWordCount === 'number' && brief.targetWordCount > 0
        ? brief.targetWordCount
        : brief.mode === 'essay'
          ? 3000
          : brief.mode === 'poetry'
            ? 800
            : brief.mode === 'nonfiction'
              ? 50000
              : brief.mode === 'script'
                ? 20000
                : brief.mode === 'musical'
                  ? 25000
                  : brief.mode === 'picture'
                    ? 500
                    : 80000,
  };
}

export async function ingestManuscript(
  text: string,
  brief: ProjectBriefLike,
  onProgress?: (message: string) => void
): Promise<{ chapters: Chapter[]; inputType: 'manuscript' | 'plan' }> {
  const projectType = briefToProjectType(brief.mode);
  onProgress?.('Recognising input type…');

  const detected = await AIService.detectIngestionType(text);
  const isPlan = detected === 'plan';
  onProgress?.(isPlan ? 'Book plan detected — extracting structure…' : 'Manuscript detected — splitting chapters…');

  let segments: { title: string; summary: string; marker: string; directives?: string[] }[] = [];
  try {
    segments = await AIService.splitManuscript(text, projectType, isPlan);
  } catch {
    segments = [];
  }

  if (segments.length === 0) {
    const chapterRegex =
      /(?:Chapter|CHAPTER|SECTION|Section|Part|PART)\s+([0-9A-Z]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)|(?:\n\n|^)(?:\* \* \*|# |### |---)(?:\n\n|$)/g;
    const matches = [...text.matchAll(chapterRegex)];

    if (matches.length >= 2) {
      segments = matches.map((m, i) => ({
        title: m[1] ? `Chapter ${m[1]}` : `Section ${i + 1}`,
        summary: 'Imported via pattern matching.',
        marker: text.slice(m.index ?? 0, (m.index ?? 0) + 120),
      }));
    } else {
      segments = [{ title: brief.title || 'Full Manuscript', summary: brief.idea, marker: text.slice(0, 200) }];
    }
  }

  const parts = splitTextByMarkers(text, segments.map((s) => s.marker));
  const chapters: Chapter[] = segments.map((seg, i) => {
    let content = isPlan ? '' : (parts[i] || '').trim();
    if (!isPlan && segments.length === 1) content = text.trim();
    return {
      id: crypto.randomUUID(),
      title: seg.title,
      summary: seg.summary,
      content,
      order: i,
      plotNodeIds: [],
      tags: [],
      isPlan,
      directives: seg.directives || [],
      updatedAt: Date.now(),
      wordCount: countWords(content),
    };
  });

  return { chapters, inputType: isPlan ? 'plan' : 'manuscript' };
}

function splitTextByMarkers(fullText: string, markers: string[]): string[] {
  if (markers.length <= 1) return [fullText];
  const parts: string[] = [];
  let cursor = 0;

  for (let i = 0; i < markers.length; i += 1) {
    const marker = markers[i];
    const idx = fullText.indexOf(marker, cursor);
    if (idx === -1) {
      parts.push(i === 0 ? fullText : '');
      continue;
    }
    if (i > 0) parts.push(fullText.slice(cursor, idx).trim());
    cursor = idx;
  }
  parts.push(fullText.slice(cursor).trim());
  return parts.length === markers.length ? parts : [fullText];
}

export async function diagnoseManuscript(
  chapters: Chapter[],
  brief: ProjectBriefLike,
  inputType: 'manuscript' | 'plan'
): Promise<Diagnosis> {
  const project = briefToProject(brief);
  const fullText = chapters
    .map((c) => `[CHAPTER ${c.order + 1}: ${c.title}]\n${c.summary}\n${c.content}`)
    .join('\n\n');
  const wordCount = totalWords(chapters);
  const chapterSummaries: ChapterSummary[] = chapters.map((c) => {
    const wc = countWords(c.content);
    return {
      order: c.order,
      title: c.title,
      summary: c.summary || 'No summary',
      wordCount: wc,
      needsWork: wc < 200 || !c.content?.trim(),
    };
  });

  const showPackContext = formatShowPackForWriting();
  const target = project.targetWordCount || 50000;
  const nonfictionDiagnosis = isNonfictionBrief(brief)
    ? `\nNONFICTION DIAGNOSIS CONTRACT:\n- Treat this as a guide/reference work, not fiction.\n- Assess coverage, factual support, reader navigation, chapter purpose, examples, practical utility, duplication, unsupported assertions, citation needs, glossary/index/resources opportunities, and useful figures/tables.\n- Identify material promised but not delivered.\n- Explicitly flag chapters that are too thin for a ${target.toLocaleString()}-word finished book.\n`
    : '';

  const prompt = `You are Caspa's Master Editor. Analyse this ${inputType} for "${brief.title}" (${project.type}).

${LITERARY_BRIEF}
TARGET FINISHED LENGTH: ${target.toLocaleString()} words (acceptable final range ${Math.round(target * FINISH_FLOOR).toLocaleString()}–${Math.round(target * FINISH_CEILING).toLocaleString()}).
${nonfictionDiagnosis}
INPUT TYPE: ${inputType}
TONE TARGET: ${brief.tone}
PREMISE: ${brief.idea}
${showPackContext ? `\n${showPackContext}\n` : ''}
MANUSCRIPT / PLAN:
${fullText.slice(0, 90000)}

Return JSON only:
{
  "verdict": "2-3 sentence editorial verdict — be direct, not polite",
  "viabilityScore": 0-100,
  "suggestRebuild": boolean,
  "editorNotes": "markdown summary of key issues",
  "recommendations": [
    {
      "id": "rec-1",
      "title": "short action title",
      "detail": "specific editorial instruction",
      "severity": "critical|major|minor",
      "defaultSelected": true/false,
      "actionType": "cut|restructure|rewrite|research|rebuild",
      "chapterRefs": [1, 2]
    }
  ]
}

Rules:
- Give 3-6 concrete recommendations, not vague advice
- Flag abandoned threads/promises and structural collapse
- If the work needs full restructure, set suggestRebuild true and include a rebuild recommendation
- Be willing to say the idea isn't working
${inputType === 'plan' ? '- This is a PLAN not prose — recommend structure fixes and drafting order, not line edits' : ''}`;

  const raw = await AIService.callAI({ prompt, json: true, model: 'gemini-2.0-flash', maxTokens: 4096 });
  const parsed = safeParseJSON(raw, {});
  const recommendations: Recommendation[] = (parsed.recommendations || []).map(
    (r: Partial<Recommendation>, i: number) => ({
      id: r.id || `rec-${i + 1}`,
      title: r.title || 'Improvement',
      detail: r.detail || '',
      severity: r.severity || 'major',
      defaultSelected: r.defaultSelected !== false,
      actionType: r.actionType || 'rewrite',
      chapterRefs: r.chapterRefs,
    })
  );

  if (parsed.suggestRebuild && !recommendations.some((r) => r.actionType === 'rebuild')) {
    recommendations.unshift({
      id: 'rec-rebuild',
      title: 'Rip up and rebuild from premise',
      detail: 'Rebuild the structure while preserving valuable source material and reader promises.',
      severity: 'critical',
      defaultSelected: false,
      actionType: 'rebuild',
    });
  }

  return {
    verdict: parsed.verdict || 'Analysis complete.',
    inputType: inputType === 'plan' ? 'plan' : chapters.some((c) => c.content?.trim()) ? 'manuscript' : 'plan',
    wordCount,
    chapterCount: chapters.length,
    viabilityScore: typeof parsed.viabilityScore === 'number' ? parsed.viabilityScore : 50,
    suggestRebuild: Boolean(parsed.suggestRebuild),
    recommendations,
    chapterSummaries,
    editorNotes: parsed.editorNotes || '',
  };
}

const LITERARY_BRIEF = `Apply prize-calibre editorial standards, but use measurable acceptance criteria rather than decorative ambition. Structure first, prose second. Protect the reader from unfulfilled promises, unsupported claims and unfinished work.`;

function safeParseJSON(text: string, fallback: Record<string, any>) {
  try {
    return JSON.parse(text);
  } catch {
    try {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) return JSON.parse(match[1]);
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) return JSON.parse(text.slice(start, end + 1));
    } catch {
      /* fall through */
    }
    return fallback;
  }
}

type ServerJob = {
  id: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  progress?: number;
  stage?: string;
  error?: string;
  result?: {
    artefact?: string;
    finalText?: string;
    chapters?: Chapter[];
    promises?: StoryPromise[];
    words?: number;
    targetWords?: number;
  };
};

function readActiveJobId(brief: ProjectBriefLike): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(activeJobKey(brief)); } catch { return null; }
}

function rememberActiveJobId(brief: ProjectBriefLike, jobId: string) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(activeJobKey(brief), jobId); } catch { /* ignore */ }
}

function forgetActiveJobId(brief: ProjectBriefLike) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(activeJobKey(brief)); } catch { /* ignore */ }
}

async function getServerJob(jobId: string): Promise<ServerJob | null> {
  const response = await fetch(`/api/caspa/gold/jobs/${encodeURIComponent(jobId)}`, { cache: 'no-store' });
  if (response.status === 404) return null;
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.success || !json?.data) throw new Error(json?.message || 'Could not read Atlas job status');
  return json.data as ServerJob;
}

function progressMessage(job: ServerJob): string {
  const stage = job.stage || job.status;
  if (stage.startsWith('writing:')) {
    const [, chapter, ...title] = stage.split(':');
    return `Atlas is writing chapter ${chapter}${title.length ? ` — ${title.join(':')}` : ''}. You can close this screen.`;
  }
  if (stage.startsWith('length-audit:')) return 'Atlas is checking length and expanding missing substance. You can close this screen.';
  if (stage === 'rebuilding') return 'Atlas is rebuilding the book architecture. You can close this screen.';
  if (stage === 'final-qa') return 'Atlas is running final QA. You can close this screen.';
  if (stage === 'resuming') return 'Atlas resumed this job from its server checkpoint.';
  return 'Atlas owns this finish job now. You can close the browser or lock your phone.';
}

async function pollServerJob(
  brief: ProjectBriefLike,
  jobId: string,
  onProgress: (p: CommissionProgress) => void,
  fallbackPromises: StoryPromise[]
): Promise<{ chapters: Chapter[]; artefact: string; promises: StoryPromise[] }> {
  for (;;) {
    const job = await getServerJob(jobId);
    if (!job) {
      forgetActiveJobId(brief);
      throw new Error('The saved Atlas finish job could not be found. Start the finish run again.');
    }

    onProgress({
      phase: job.stage || job.status,
      message: progressMessage(job),
      percent: Math.max(1, Math.min(100, Number(job.progress || 0))),
    });

    if (job.status === 'complete') {
      const artefact = String(job.result?.artefact || job.result?.finalText || '');
      const chapters = Array.isArray(job.result?.chapters) ? job.result!.chapters! : [];
      if (!artefact || !chapters.length) throw new Error('Atlas completed the job but the finished manuscript payload is missing.');
      forgetActiveJobId(brief);
      return {
        chapters,
        artefact,
        promises: Array.isArray(job.result?.promises) ? job.result!.promises! : fallbackPromises,
      };
    }

    if (job.status === 'failed') {
      // Keep the id: pressing Finish again resumes the same persisted checkpoint.
      throw new Error(job.error || 'The Atlas finish job stopped. Its server checkpoint has been retained for retry.');
    }

    await new Promise((resolve) => setTimeout(resolve, 2200));
  }
}

export async function executeCommission(
  brief: ProjectBriefLike,
  chapters: Chapter[],
  diagnosis: Diagnosis,
  selectedRecommendationIds: string[],
  scope: CommissionScope,
  onProgress: (p: CommissionProgress) => void,
  options?: { autoResearch?: boolean; promises?: StoryPromise[] }
): Promise<{ chapters: Chapter[]; artefact: string; promises: StoryPromise[] }> {
  const fallbackPromises = options?.promises || [];

  // If the browser/mobile was closed mid-run, reconnect to the existing Atlas
  // job instead of submitting another book. A short status request is all the
  // browser owns; the long work stays on the server.
  const remembered = readActiveJobId(brief);
  if (remembered) {
    try {
      const existing = await getServerJob(remembered);
      if (existing && (existing.status === 'queued' || existing.status === 'running')) {
        onProgress({ phase: 'resume', message: 'Reconnected to the Atlas finish job. The server kept working while you were away.', percent: Number(existing.progress || 1) });
        return await pollServerJob(brief, remembered, onProgress, fallbackPromises);
      }
      if (existing?.status === 'complete') {
        return await pollServerJob(brief, remembered, onProgress, fallbackPromises);
      }
      if (existing?.status === 'failed') {
        // Failed jobs retain their checkpoint server-side, but a fresh job is
        // deliberately submitted from the latest client state on explicit retry.
        forgetActiveJobId(brief);
      }
    } catch {
      // If status lookup itself fails, do not create a duplicate immediately.
      throw new Error('Could not reconnect to the active Atlas finish job. Check your connection and try again; the server job has not been cancelled.');
    }
  }

  onProgress({ phase: 'submit', message: 'Handing the finish run to Atlas…', percent: 2 });
  const response = await fetch('/api/caspa/gold/commission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brief,
      chapters,
      diagnosis,
      selectedRecommendationIds,
      scope,
      autoResearch: options?.autoResearch !== false,
      promises: fallbackPromises,
    }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.success || !json?.data?.jobId) {
    throw new Error(json?.message || 'Atlas did not accept the finish job.');
  }

  const jobId = String(json.data.jobId);
  rememberActiveJobId(brief, jobId);
  onProgress({ phase: 'queued', message: 'Atlas accepted the job. You can close the browser or lock your phone.', percent: 3 });
  return await pollServerJob(brief, jobId, onProgress, fallbackPromises);
}

export function chaptersToStorage(chapters: Chapter[]): string {
  return JSON.stringify(chapters);
}

export function chaptersFromStorage(raw: string | null): Chapter[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Chapter[];
  } catch {
    return [];
  }
}
