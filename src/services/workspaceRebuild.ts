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

export type SplitOptions = {
  projectTitle?: string;
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

export function isRebuildChapterHeading(title: string): boolean {
  return !isStructuralHeading(title);
}

const TITLE_PAGE_LINE = /^(by|written by|a novel|a novella|a memoir|a story|copyright|all rights reserved|published|first published|isbn)\b/;

export function isTitlePageLine(line: string): boolean {
  const trimmed = String(line || '').trim();
  if (!trimmed) return true;
  const normalized = normalizeTitle(trimmed);
  if (TITLE_PAGE_LINE.test(normalized)) return true;
  if (!/[.!?]$/.test(trimmed) && /^[A-Z][A-Za-z.'’\-]+(\s+[A-Z][A-Za-z.'’\-]+){0,4}$/.test(trimmed)) return true;
  return false;
}

export function isTitlePageBody(body: string): boolean {
  const text = String(body || '').trim();
  if (!text) return true;
  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 8) return false;
  if (text.split(/\s+/).filter(Boolean).length > 40) return false;
  return lines.every(isTitlePageLine);
}

export function isBookTitleHeading(
  headingLine: string,
  title: string,
  index: number,
  body: string,
  headingCount: number,
  projectTitle?: string,
): boolean {
  if (index !== 0 || headingCount < 2) return false;
  if (isStructuralHeading(title) || isExplicitChapterHeading(title)) return false;
  const isH1 = /^#\s+/.test(headingLine.trim()) && !/^##/.test(headingLine.trim());
  if (!isH1) return false;
  if (projectTitle && titlesMatch(title, projectTitle)) return true;
  return isTitlePageBody(body);
}

export function parseChapterIndex(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return undefined;
}

export function splitManuscript(manuscript: string, options: SplitOptions = {}): SplitManuscript {
  const text = String(manuscript || '');
  if (!text.trim()) return { preamble: '', chapters: [] };
  const matches = [...text.matchAll(CHAPTER_HEADING)];
  if (!matches.length) {
    return {
      preamble: '',
      chapters: [{ title: 'Working draft', headingLine: '# Working draft', body: text, start: 0, end: text.length, index: 0, rebuildable: true }],
    };
  }
  const firstHeadingAt = matches[0].index || 0;
  const preamble = text.slice(0, firstHeadingAt).replace(/\s+$/, '');
  const chapters = matches.map((match, index) => {
    const start = match.index || 0;
    const next = matches[index + 1]?.index ?? text.length;
    const headingLine = match[1].trim();
    const heading = headingTitle(headingLine);
    const body = text.slice(start, next).replace(/^#+\s+[^\n]+\n?/, '').trim();
    const rebuildable = isRebuildChapterHeading(heading)
      && !isBookTitleHeading(headingLine, heading, index, body, matches.length, options.projectTitle);
    return {
      title: heading || `Section ${index + 1}`,
      headingLine,
      body,
      start,
      end: next,
      index,
      rebuildable,
    };
  });
  return { preamble, chapters };
}

export function selectRebuildChapter(
  chapters: ManuscriptChapter[],
  selection: { chapterIndex?: number; chapterTitle?: string },
): ManuscriptChapter | null {
  if (!Number.isInteger(selection.chapterIndex)) return null;
  const chapter = chapters.find((item) => item.index === selection.chapterIndex);
  if (!chapter?.rebuildable) return null;
  if (selection.chapterTitle && !titlesMatch(selection.chapterTitle, chapter.title)) return null;
  return chapter;
}

export function splitManuscriptChapters(manuscript: string, options: SplitOptions = {}): ManuscriptChapter[] {
  return splitManuscript(manuscript, options).chapters;
}

export function splitRebuildChapters(manuscript: string, options: SplitOptions = {}): ManuscriptChapter[] {
  return splitManuscript(manuscript, options).chapters.filter((chapter) => chapter.rebuildable);
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

export function applyRebuildChanges(manuscript: string, changes: RebuildChange[], options: SplitOptions = {}): string {
  const accepted = changes.filter((change) => change.status === 'accepted' && change.proposed.trim());
  if (!accepted.length) return manuscript;
  const { preamble, chapters } = splitManuscript(manuscript, options);
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

export function applySingleRebuildChange(manuscript: string, change: RebuildChange, options: SplitOptions = {}): string {
  return applyRebuildChanges(manuscript, [{ ...change, status: 'accepted' }], options);
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

export type SeededManuscriptChapter = {
  id: string;
  title: string;
  summary: string;
  content: string;
  order: number;
};

export function chaptersNeedManuscriptSeed(chapters: { content?: string }[] | undefined, manuscript: string): boolean {
  if (!String(manuscript || '').trim()) return false;
  if (!Array.isArray(chapters) || chapters.length === 0) return true;
  return chapters.every((chapter) => !String(chapter.content || '').trim());
}

export function seedChaptersFromManuscript(manuscript: string, options: SplitOptions = {}): SeededManuscriptChapter[] {
  const page = String(manuscript || '').trim();
  if (!page) return [];
  const { chapters } = splitManuscript(page, options);
  const usable = chapters.filter((chapter) => chapter.body.trim() || chapter.title);
  const source = usable.length
    ? usable
    : [{ title: 'Current page', body: page, index: 0 } as ManuscriptChapter];
  return source.map((chapter, index) => {
    const content = String(chapter.body || '').trim() || page;
    return {
      id: `ch-${(chapter.index ?? index) + 1}`,
      title: chapter.title || `Chapter ${index + 1}`,
      summary: content.slice(0, 160),
      content,
      order: index + 1,
    };
  });
}

export function pickWorkshopManuscript(live: unknown, ...fallbacks: Array<string | undefined | null>): string {
  const candidates = [typeof live === 'string' ? live : '', ...fallbacks];
  for (const item of candidates) {
    const text = String(item || '').trim();
    if (text) return text;
  }
  return '';
}

export function detectManuscriptProposal(canonical: string, candidate: string): boolean {
  return normalizeManuscript(canonical) !== normalizeManuscript(candidate);
}

export function normalizeManuscript(value: string): string {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}
