/**
 * Caspa Promise Registry Service
 * Extract, track, and audit story promises across the manuscript
 */

import { AIService } from './ai';
import type { Chapter } from '../types';
import type { ProjectBriefLike } from './commissionService';
import { briefToProject } from './commissionService';
import type { StoryPromise, PromiseStatus, PromiseType } from '../types/promise';

function storageKey(projectKey: string): string {
  return `caspa.promises.${projectKey}`;
}

export function loadPromises(projectKey: string): StoryPromise[] {
  try {
    const raw = localStorage.getItem(storageKey(projectKey));
    if (!raw) return [];
    return JSON.parse(raw) as StoryPromise[];
  } catch {
    return [];
  }
}

export function savePromises(projectKey: string, promises: StoryPromise[]): void {
  localStorage.setItem(storageKey(projectKey), JSON.stringify(promises));
}

function safeParseJSON(text: string, fallback: Record<string, unknown>) {
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

export async function extractPromises(
  chapters: Chapter[],
  brief: ProjectBriefLike
): Promise<StoryPromise[]> {
  const project = briefToProject(brief);
  const fullText = chapters
    .map((c) => `[CHAPTER ${c.order + 1}: ${c.title}]\n${c.summary}\n${c.content?.slice(0, 3000)}`)
    .join('\n\n');

  const prompt = `You are Caspa's Promise Tracker. A story promise is anything the narrative sets up that the reader expects to be fulfilled:
- plot promises (mysteries, objects, threats, questions)
- character promises (arc milestones, confrontations, transformations)
- theme promises (arguments the book makes)
- revelation promises (twists foreshadowed)
- emotional promises (the feeling the ending must deliver)

Analyse "${brief.title}" (${project.type}).

PREMISE: ${brief.idea}

TEXT:
${fullText.slice(0, 80000)}

Return JSON only:
{
  "promises": [
    {
      "id": "promise-1",
      "type": "plot|character|theme|revelation|emotional",
      "statement": "clear description of what was promised to the reader",
      "setupChapter": 1,
      "payoffChapter": 12,
      "status": "planted|developing|paid_off|broken|cut_advised|open",
      "riskScore": 0-100,
      "notes": "why this matters or what's wrong"
    }
  ]
}

Rules:
- List 5-15 significant promises, not trivial details
- Mark broken if setup exists with no credible payoff path
- Mark cut_advised if the promise weakens the book
- High riskScore = likely to disappoint the reader if unresolved
- Be ruthless about abandoned subplots and Chekhov's guns`;

  const raw = await AIService.callAI({
    prompt,
    json: true,
    model: 'gemini-2.0-flash',
    maxTokens: 4096,
  });

  const parsed = safeParseJSON(raw, { promises: [] });
  const list = Array.isArray(parsed.promises) ? parsed.promises : [];

  return list.map((p: Partial<StoryPromise>, i: number) => ({
    id: p.id || `promise-${i + 1}`,
    type: (p.type as PromiseType) || 'plot',
    statement: p.statement || 'Unnamed promise',
    setupChapter: p.setupChapter,
    payoffChapter: p.payoffChapter,
    status: (p.status as PromiseStatus) || 'open',
    riskScore: typeof p.riskScore === 'number' ? p.riskScore : 50,
    notes: p.notes,
  }));
}

export async function auditPromises(
  chapters: Chapter[],
  brief: ProjectBriefLike,
  existing: StoryPromise[]
): Promise<StoryPromise[]> {
  if (existing.length === 0) {
    return extractPromises(chapters, brief);
  }

  const fullText = chapters
    .map((c) => `[CHAPTER ${c.order + 1}: ${c.title}]\n${c.content?.slice(0, 2500)}`)
    .join('\n\n');

  const prompt = `Re-audit these story promises against the updated manuscript for "${brief.title}".

EXISTING PROMISES:
${JSON.stringify(existing, null, 2)}

MANUSCRIPT:
${fullText.slice(0, 70000)}

Update status and riskScore for each promise. Add new promises if the draft introduced setups.
Return JSON: { "promises": [...] } with same schema.`;

  const raw = await AIService.callAI({
    prompt,
    json: true,
    model: 'gemini-2.0-flash',
    maxTokens: 4096,
  });

  const parsed = safeParseJSON(raw, { promises: existing });
  const list = Array.isArray(parsed.promises) ? parsed.promises : existing;

  return list.map((p: Partial<StoryPromise>, i: number) => ({
    id: p.id || existing[i]?.id || `promise-${i + 1}`,
    type: (p.type as PromiseType) || existing[i]?.type || 'plot',
    statement: p.statement || existing[i]?.statement || '',
    setupChapter: p.setupChapter ?? existing[i]?.setupChapter,
    payoffChapter: p.payoffChapter ?? existing[i]?.payoffChapter,
    status: (p.status as PromiseStatus) || existing[i]?.status || 'open',
    riskScore: typeof p.riskScore === 'number' ? p.riskScore : existing[i]?.riskScore ?? 50,
    notes: p.notes ?? existing[i]?.notes,
  }));
}

export function formatPromisesForDraft(promises: StoryPromise[], chapterOrder: number): string[] {
  const relevant = promises.filter((p) => {
    if (['paid_off', 'cut_advised'].includes(p.status)) return false;
    if (p.payoffChapter && p.payoffChapter === chapterOrder + 1) return true;
    if (p.setupChapter && p.setupChapter <= chapterOrder + 1 && ['open', 'planted', 'developing', 'broken'].includes(p.status))
      return true;
    return p.riskScore >= 65;
  });

  return relevant.map(
    (p) =>
      `[PROMISE ${p.type.toUpperCase()} — ${p.status}] ${p.statement}${
        p.payoffChapter ? ` (payoff expected by ch.${p.payoffChapter})` : ''
      }${p.notes ? `. ${p.notes}` : ''}`
  );
}

export function openPromiseWarnings(promises: StoryPromise[]): string[] {
  return promises
    .filter((p) => p.status === 'broken' || (p.riskScore >= 75 && p.status !== 'paid_off'))
    .map((p) => `⚠ ${p.statement} (${p.status}, risk ${p.riskScore}%)`);
}
