/**
 * Caspa Research Library — local storage + deep research API
 */

import type { ResearchNote } from '../types';
import type { ProjectBriefLike } from './commissionService';
import { AIService } from './ai';
import { briefToProject } from './commissionService';

export interface StoredResearchNote extends ResearchNote {
  verificationStatus?: 'unverified' | 'verified' | 'contradicted';
  verificationNotes?: string;
  topicQuery?: string;
}

export function getProjectKey(brief: ProjectBriefLike): string {
  const slug = brief.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'default-project';
}

function storageKey(projectKey: string): string {
  return `caspa.research.${projectKey}`;
}

export function loadLibrary(projectKey: string): StoredResearchNote[] {
  try {
    const raw = localStorage.getItem(storageKey(projectKey));
    if (!raw) return [];
    return JSON.parse(raw) as StoredResearchNote[];
  } catch {
    return [];
  }
}

export function saveLibrary(projectKey: string, notes: StoredResearchNote[]): void {
  localStorage.setItem(storageKey(projectKey), JSON.stringify(notes));
}

export function addNote(projectKey: string, note: StoredResearchNote): StoredResearchNote[] {
  const library = loadLibrary(projectKey);
  const next = [{ ...note, id: note.id || crypto.randomUUID(), updatedAt: Date.now() }, ...library];
  saveLibrary(projectKey, next);
  return next;
}

export function removeNote(projectKey: string, id: string): StoredResearchNote[] {
  const next = loadLibrary(projectKey).filter((n) => n.id !== id);
  saveLibrary(projectKey, next);
  return next;
}

export async function deepResearchTopic(
  topic: string,
  brief: ProjectBriefLike,
  extraContext = ''
): Promise<StoredResearchNote> {
  const project = briefToProject(brief);
  const context = `${brief.idea}\n${brief.tone}\n${extraContext}`.trim();

  try {
    const response = await fetch('/api/caspa/research/deep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        context,
        projectType: project.type,
        genre: project.genre,
        title: project.title,
      }),
    });

    const payload = await response.json();

    if (response.ok && payload.success) {
      return payload.data as StoredResearchNote;
    }

    if (payload.message === 'web_search_unavailable') {
      return fallbackLocalResearch(topic, brief, context, true);
    }

    throw new Error(payload.message || 'Research request failed');
  } catch (err) {
    console.warn('[Research Library] Server deep research failed, using local fallback:', err);
    return fallbackLocalResearch(topic, brief, context, false);
  }
}

async function fallbackLocalResearch(
  topic: string,
  brief: ProjectBriefLike,
  context: string,
  searchUnavailable: boolean
): Promise<StoredResearchNote> {
  const project = briefToProject(brief);
  const note = await AIService.compileResearch(topic, context, project.type, true);
  return {
    ...note,
    topicQuery: topic,
    verificationStatus: searchUnavailable ? 'unverified' : 'verified',
    verificationNotes: searchUnavailable
      ? 'Live web search unavailable — generated from model knowledge only. Verify place names and facts before publishing.'
      : '',
    sources: note.sources?.length ? note.sources : ['AI synthesis'],
  };
}

export async function suggestResearchTopics(
  brief: ProjectBriefLike,
  manuscriptText: string
): Promise<string[]> {
  const project = briefToProject(brief);

  try {
    const response = await fetch('/api/caspa/research/suggest-topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: manuscriptText,
        projectType: project.type,
        title: project.title,
        premise: project.premise,
      }),
    });

    if (response.ok) {
      const payload = await response.json();
      if (payload.success && Array.isArray(payload.data?.topics)) {
        return payload.data.topics as string[];
      }
    }
  } catch {
    /* fall through */
  }

  return AIService.extractResearchNeeds(manuscriptText, project.type);
}

export function searchLibrary(notes: StoredResearchNote[], query: string): StoredResearchNote[] {
  const q = query.toLowerCase().trim();
  if (!q) return notes;
  return notes.filter(
    (n) =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q)) ||
      n.category.toLowerCase().includes(q)
  );
}

export function findRelevantForChapter(
  notes: StoredResearchNote[],
  chapter: { title: string; summary: string; content?: string },
  brief: ProjectBriefLike
): ResearchNote[] {
  if (notes.length === 0) return [];

  const haystack = `${chapter.title} ${chapter.summary} ${chapter.content || ''} ${brief.idea}`.toLowerCase();

  const scored = notes.map((note) => {
    let score = 0;
    const titleWords = note.title.toLowerCase().split(/\s+/);
    for (const word of titleWords) {
      if (word.length > 3 && haystack.includes(word)) score += 2;
    }
    for (const tag of note.tags) {
      if (tag.length > 2 && haystack.includes(tag.toLowerCase())) score += 3;
    }
    if (note.topicQuery && haystack.includes(note.topicQuery.toLowerCase().slice(0, 20))) score += 4;
    if (note.verificationStatus === 'verified') score += 1;
    return { note, score };
  });

  const relevant = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

  if (relevant.length > 0) {
    return relevant.slice(0, 8).map((s) => s.note);
  }

  return notes.slice(0, 6);
}

export function formatResearchForDraft(notes: ResearchNote[]): string {
  if (!notes.length) return '';
  return notes
    .map(
      (n) =>
        `[RESEARCH: ${n.title}]\n${n.content.slice(0, 2500)}${
          n.sources?.length ? `\nSources: ${n.sources.join('; ')}` : ''
        }`
    )
    .join('\n\n');
}
