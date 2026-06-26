import type { Chapter } from '../types';

export function isSourceChapter(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes('source manuscript')
    || lower.includes('uploaded manuscript')
    || lower.startsWith('source white page')
    || lower.startsWith('imported manuscript');
}

export function pickContinueChapter(chapters: Chapter[]): Chapter | null {
  if (chapters.length === 0) return null;
  const sorted = [...chapters].sort((a, b) => b.order - a.order);
  const working = sorted.find((chapter) => !isSourceChapter(chapter.title) && chapter.status !== 'outline');
  if (working) return working;
  const latestDraft = sorted.find((chapter) => !isSourceChapter(chapter.title));
  return latestDraft ?? sorted[0];
}

/** Chapter whose text should be improved — prefers labelled source, else longest draft. */
export function pickImprovementSourceChapter(chapters: Chapter[]): Chapter | null {
  const source = chapters.find((chapter) => isSourceChapter(chapter.title));
  if (source) return source;
  const withWords = chapters
    .filter((chapter) => chapter.wordCount > 0 || chapter.content?.trim())
    .sort((a, b) => b.wordCount - a.wordCount);
  return withWords[0] ?? chapters[0] ?? null;
}

export function casperImproveUrl(projectId: string, chapterId?: string): string {
  const params = new URLSearchParams({ projectId, improve: '1' });
  if (chapterId) params.set('chapterId', chapterId);
  return `/casper?${params.toString()}`;
}
