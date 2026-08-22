export type RebuildChangeStatus = 'pending' | 'accepted' | 'rejected';

export type RebuildChange = {
  id: string;
  chapterTitle: string;
  chapterIndex?: number;
  currentExcerpt: string;
  proposed: string;
  rationale: string;
  status: RebuildChangeStatus;
};

export type ManuscriptChapter = {
  title: string;
  headingLine: string;
  body: string;
  start: number;
  end: number;
  index: number;
  rebuildable: boolean;
};

export type SplitManuscript = {
  preamble: string;
  chapters: ManuscriptChapter[];
};

const CHAPTER_HEADING = /^(#{1,3}\s+.+)$/gm;

const STRUCTURAL_HEADING = /^(contents|table of contents|title|title page|copyright|dedication|acknowledgements|acknowledgments|about the author|foreword|preface|index|cast of characters|also by)\b/;
const PART_HEADING = /^(book|part|volume|act)\b/;
const EXPLICIT_CHAPTER = /^(chapter|ch|chap)\s+(\d+|[ivxlcdm]+)\b|^\d+([.:)\s]|$)|\b(prologue|epilogue)\b/;

export function headingTitle(value: string): string {
  return String(value || '').replace(/^#+\s+/, '').trim();
}

export function isStructuralHeading(title: string): boolean {
  const normalized = normalizeTitle(title);
  return STRUCTURAL_HEADING.test(normalized) || PART_HEADING.test(normalized);
}

export function isExplicitChapterHeading(title: string): boolean {
  return EXPLICIT_CHAPTER.test(normalizeTitle(title));
}

export function isRebuildChapterHeading(title: string, options?: { preferExplicit?: boolean }): boolean {
  if (isStructuralHeading(title)) return false;
  if (options?.preferExplicit) return isExplicitChapterHeading(title);
  return true;
}

export function splitManuscript(manuscript: string): SplitManuscript {
  const text = String(manuscript || '');
  if (!text.trim()) return { preamble: '', chapters: [] };
  const matches = [...text.matchAll(CHAPTER_HEADING)];
  if (!matches.length) {
    return {
      preamble: '',
      chapters: [{ title: 'Working draft', headingLine: '# Working draft', body: text, start: 0, end: text.length, index: 0, rebuildable: true }],
    };
  }
  const preferExplicit = matches.some((match) => isExplicitChapterHeading(headingTitle(match[1])));
  const firstHeadingAt = matches[0].index || 0;
  const preamble = text.slice(0, firstHeadingAt).replace(/\s+$/, '');
  const chapters = matches.map((match, index) => {
    const start = match.index || 0;
    const next = matches[index + 1]?.index ?? text.length;
    const headingLine = match[1].trim();
    const heading = headingTitle(headingLine);
    const body = text.slice(start, next).replace(/^#+\s+[^\n]+\n?/, '').trim();
    return {
      title: heading || `Section ${index + 1}`,
      headingLine,
      body,
      start,
      end: next,
      index,
      rebuildable: isRebuildChapterHeading(heading, { preferExplicit }),
    };
  });
  return { preamble, chapters };
}

export function splitManuscriptChapters(manuscript: string): ManuscriptChapter[] {
  return splitManuscript(manuscript).chapters;
}

export function splitRebuildChapters(manuscript: string): ManuscriptChapter[] {
  return splitManuscript(manuscript).chapters.filter((chapter) => chapter.rebuildable);
}

export function chaptersToManuscript(chapters: Array<{ title: string; body: string; headingLine?: string }>): string {
  return assembleManuscript('', chapters);
}

export function assembleManuscript(
  preamble: string,
  chapters: Array<{ title: string; body: string; headingLine?: string }>,
): string {
  const body = chapters
    .map((chapter) => `${chapter.headingLine?.trim() || `# ${chapter.title}`}\n\n${chapter.body}`.trim())
    .join('\n\n');
  const lead = String(preamble || '').replace(/\s+$/, '');
  return [lead, body].filter((part) => part.trim()).join('\n\n');
}

export function applyRebuildChanges(manuscript: string, changes: RebuildChange[]): string {
  const accepted = changes.filter((change) => change.status === 'accepted' && change.proposed.trim());
  if (!accepted.length) return manuscript;
  const { preamble, chapters } = splitManuscript(manuscript);
  if (!chapters.length) return manuscript;
  const next = chapters.map((chapter) => {
    const change = accepted.find((item) => changeTargetsChapter(item, chapter, chapters));
    if (!change || !chapter.rebuildable) {
      return { title: chapter.title, headingLine: chapter.headingLine, body: chapter.body };
    }
    return { title: chapter.title, headingLine: chapter.headingLine, body: change.proposed.trim() };
  });
  return assembleManuscript(preamble, next);
}

export function applySingleRebuildChange(manuscript: string, change: RebuildChange): string {
  return applyRebuildChanges(manuscript, [{ ...change, status: 'accepted' }]);
}

export function changeTargetsChapter(
  change: Pick<RebuildChange, 'chapterTitle' | 'chapterIndex'>,
  chapter: ManuscriptChapter,
  allChapters: ManuscriptChapter[],
): boolean {
  if (!chapter.rebuildable) return false;
  if (Number.isInteger(change.chapterIndex)) {
    return change.chapterIndex === chapter.index;
  }
  const matches = allChapters.filter((item) => item.rebuildable && titlesMatch(change.chapterTitle, item.title));
  if (matches.length !== 1) return false;
  return matches[0].index === chapter.index;
}

export function titlesMatch(left: string, right: string): boolean {
  return normalizeTitle(left) === normalizeTitle(right);
}

function normalizeTitle(value: string): string {
  return String(value || '')
    .replace(/^#+\s+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function detectManuscriptProposal(canonical: string, candidate: string): boolean {
  return normalizeManuscript(canonical) !== normalizeManuscript(candidate);
}

export function normalizeManuscript(value: string): string {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}
