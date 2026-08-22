export type RebuildChangeStatus = 'pending' | 'accepted' | 'rejected';

export type RebuildChange = {
  id: string;
  chapterTitle: string;
  currentExcerpt: string;
  proposed: string;
  rationale: string;
  status: RebuildChangeStatus;
};

export type ManuscriptChapter = {
  title: string;
  body: string;
  start: number;
  end: number;
};

const CHAPTER_HEADING = /^(#{1,3}\s+.+)$/gm;

export function splitManuscriptChapters(manuscript: string): ManuscriptChapter[] {
  const text = String(manuscript || '');
  if (!text.trim()) return [];
  const matches = [...text.matchAll(CHAPTER_HEADING)];
  if (!matches.length) {
    return [{ title: 'Working draft', body: text, start: 0, end: text.length }];
  }
  return matches.map((match, index) => {
    const start = match.index || 0;
    const next = matches[index + 1]?.index ?? text.length;
    const heading = match[1].replace(/^#+\s+/, '').trim();
    const body = text.slice(start, next).replace(/^#+\s+[^\n]+\n?/, '').trim();
    return { title: heading || `Section ${index + 1}`, body, start, end: next };
  });
}

export function chaptersToManuscript(chapters: Array<{ title: string; body: string }>): string {
  return chapters
    .map((chapter) => `# ${chapter.title}\n\n${chapter.body}`.trim())
    .join('\n\n');
}

export function applyRebuildChanges(manuscript: string, changes: RebuildChange[]): string {
  const accepted = changes.filter((change) => change.status === 'accepted' && change.proposed.trim());
  if (!accepted.length) return manuscript;
  const chapters = splitManuscriptChapters(manuscript);
  if (!chapters.length) return manuscript;
  const next = chapters.map((chapter) => {
    const change = accepted.find((item) => titlesMatch(item.chapterTitle, chapter.title));
    return change ? { title: chapter.title, body: change.proposed.trim() } : { title: chapter.title, body: chapter.body };
  });
  return chaptersToManuscript(next);
}

export function applySingleRebuildChange(manuscript: string, change: RebuildChange): string {
  return applyRebuildChanges(manuscript, [{ ...change, status: 'accepted' }]);
}

export function titlesMatch(left: string, right: string): boolean {
  return normalizeTitle(left) === normalizeTitle(right);
}

function normalizeTitle(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/^chapter\s+\d+[:.\s-]*/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function detectManuscriptProposal(canonical: string, candidate: string): boolean {
  return normalizeManuscript(canonical) !== normalizeManuscript(candidate);
}

export function normalizeManuscript(value: string): string {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}
