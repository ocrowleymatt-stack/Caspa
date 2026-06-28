import type { Chapter } from '../types';

export function isPlanOrOutlineText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const head = trimmed.slice(0, 4000).toLowerCase();
  if (
    /book plan|outline|table of contents|beat sheet|chapter breakdown|scene breakdown|story plan|scene list|chapter list|act structure|three-act/i.test(head)
  ) {
    return true;
  }

  const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 4) return false;

  const structured = lines.filter((line) =>
    /^[#*\-\d.]/.test(line)
    || /^chapter\s+\d/i.test(line)
    || /^act\s+[ivx\d]+/i.test(line)
    || /^part\s+[ivx\d]+/i.test(line),
  ).length;

  const words = trimmed.split(/\s+/).filter(Boolean).length;
  if (structured / lines.length >= 0.4 && words < 6000) return true;

  const avgLineWords = words / lines.length;
  return structured >= 6 && avgLineWords < 18;
}

export function isSourceMaterialChapter(chapter: Pick<Chapter, 'title' | 'sourceRole' | 'unitStatus' | 'status' | 'content'>): boolean {
  if (chapter.sourceRole === 'original' || chapter.unitStatus === 'source') return true;
  if (chapter.status === 'outline') return true;

  const lower = chapter.title.toLowerCase();
  if (
    lower.includes('source manuscript')
    || lower.includes('uploaded manuscript')
    || lower.startsWith('source white page')
    || lower.startsWith('book plan')
    || lower.includes('book plan')
  ) {
    return true;
  }

  return Boolean(chapter.content?.trim() && isPlanOrOutlineText(chapter.content));
}

export function isSourceChapter(chapter: Pick<Chapter, 'title' | 'sourceRole' | 'unitStatus'>): boolean {
  if (chapter.sourceRole === 'original' || chapter.unitStatus === 'source') {
    return true;
  }
  const lower = chapter.title.toLowerCase();
  return lower.includes('source manuscript')
    || lower.includes('uploaded manuscript')
    || lower.startsWith('source white page')
    || lower.startsWith('imported manuscript');
}

export function pickContinueChapter(chapters: Chapter[]): Chapter | null {
  if (chapters.length === 0) return null;
  const sorted = [...chapters].sort((a, b) => b.order - a.order);
  const working = sorted.find((chapter) => !isSourceChapter(chapter) && chapter.status !== 'outline');
  if (working) return working;
  const latestDraft = sorted.find((chapter) => !isSourceChapter(chapter));
  return latestDraft ?? sorted[0];
}

/** Chapter whose text should be improved — prefers labelled source, else longest draft. */
export function pickImprovementSourceChapter(chapters: Chapter[]): Chapter | null {
  const source = chapters.find((chapter) => isSourceChapter(chapter));
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
