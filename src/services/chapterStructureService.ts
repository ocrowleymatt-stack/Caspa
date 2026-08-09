import type { Chapter } from '../types';

const COMMISSION_KEY = 'caspa.commission';

function wc(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function id() {
  try { return crypto.randomUUID(); } catch { return `ch-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

export function normaliseChapterTitle(raw: string, index: number, mode = 'novel') {
  const clean = raw
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\s*(chapter|section|part|book|scene)\s+/i, (m) => m.trim() + ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean) return clean.slice(0, 140);
  const noun = mode === 'nonfiction' || mode === 'essay' ? 'Section' : mode === 'script' || mode === 'musical' ? 'Scene' : 'Chapter';
  return `${noun} ${index + 1}`;
}

type Marker = { start: number; end: number; title: string; score: number };

function headingMarkers(text: string): Marker[] {
  const lines = text.split('\n');
  const starts: number[] = [];
  let cursor = 0;
  for (const line of lines) { starts.push(cursor); cursor += line.length + 1; }

  const candidates: Marker[] = [];
  const special = /^(prologue|epilogue|introduction|preface|foreword|afterword|conclusion|interlude|acknowledg(?:e)?ments|appendix(?:\s+[A-Z0-9IVXLC]+)?)(?:\s*[:—-]\s*(.+))?$/i;
  const labelled = /^(chapter|section|part|book|scene)\s+([0-9]{1,4}|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)(?:\s*[:.—-]\s*(.+))?$/i;
  const numberedTitle = /^([0-9]{1,3}|[IVXLC]{1,8})[.)]\s+(.{2,100})$/;
  const markdown = /^#{1,3}\s+(.{1,140})$/;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const prevBlank = i === 0 || !lines[i - 1].trim();
    const nextBlank = i === lines.length - 1 || !lines[i + 1].trim();
    let title = '';
    let score = 0;
    const md = line.match(markdown);
    const lab = line.match(labelled);
    const sp = line.match(special);
    const num = line.match(numberedTitle);
    if (md) { title = md[1]; score = 10; }
    else if (lab) { title = line; score = 10; }
    else if (sp) { title = line; score = 10; }
    else if (num && prevBlank) { title = line; score = 8; }
    else {
      const allCaps = line.length >= 3 && line.length <= 90 && line === line.toUpperCase() && /[A-Z]/.test(line) && !/[.!?]$/.test(line);
      const titleCase = line.length >= 3 && line.length <= 80 && /^[A-Z][^.!?]{2,79}$/.test(line) && line.split(/\s+/).length <= 10;
      if (prevBlank && nextBlank && allCaps) { title = line; score = 5; }
      else if (prevBlank && nextBlank && titleCase) { title = line; score = 3; }
    }
    if (title) candidates.push({ start: starts[i], end: starts[i] + raw.length, title, score });
  });

  // Strong headings win. Soft title-like lines are only trusted when several of them
  // form a plausible book-length sequence, avoiding dialogue/prose false positives.
  const strong = candidates.filter((c) => c.score >= 8);
  if (strong.length >= 2) return strong;
  const medium = candidates.filter((c) => c.score >= 5);
  if (medium.length >= 3) return medium;
  return candidates.filter((c) => c.score >= 3).length >= 4 ? candidates.filter((c) => c.score >= 3) : [];
}

export function detectChapters(text: string, mode = 'novel'): Chapter[] {
  const source = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!source) return [];
  const markers = headingMarkers(source);
  if (markers.length < 2) {
    return [{
      id: id(), title: normaliseChapterTitle('', 0, mode), summary: '', content: source,
      order: 0, plotNodeIds: [], tags: [], updatedAt: Date.now(), wordCount: wc(source),
    } as Chapter];
  }

  const chapters: Chapter[] = [];
  const preamble = source.slice(0, markers[0].start).trim();
  if (wc(preamble) >= 80) {
    chapters.push({
      id: id(), title: mode === 'nonfiction' || mode === 'essay' ? 'Opening / front matter' : 'Front matter',
      summary: 'Detected before the first explicit chapter heading.', content: preamble,
      order: chapters.length, plotNodeIds: [], tags: [], updatedAt: Date.now(), wordCount: wc(preamble),
    } as Chapter);
  }

  markers.forEach((marker, i) => {
    const next = markers[i + 1];
    const body = source.slice(marker.end, next ? next.start : source.length).trim();
    // Ignore obvious false-positive headings that create empty crumbs.
    if (wc(body) < 8 && i < markers.length - 1) return;
    chapters.push({
      id: id(),
      title: normaliseChapterTitle(marker.title, chapters.length, mode),
      summary: 'Detected from manuscript heading.',
      content: body,
      order: chapters.length,
      plotNodeIds: [], tags: [], updatedAt: Date.now(), wordCount: wc(body),
    } as Chapter);
  });

  return chapters.length ? chapters : [{
    id: id(), title: normaliseChapterTitle('', 0, mode), summary: '', content: source,
    order: 0, plotNodeIds: [], tags: [], updatedAt: Date.now(), wordCount: wc(source),
  } as Chapter];
}

export function manuscriptFromChapters(chapters: Chapter[]) {
  return chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((c) => `# ${c.title}\n\n${c.content || ''}`.trim())
    .join('\n\n');
}

export function loadChapterWorkspace(mode = 'novel'): Chapter[] {
  try {
    const raw = localStorage.getItem(COMMISSION_KEY);
    if (raw) {
      const state = JSON.parse(raw);
      if (Array.isArray(state.chapters) && state.chapters.length) return state.chapters;
    }
  } catch { /* continue */ }
  const text = localStorage.getItem('caspa.whitePage') || localStorage.getItem('caspa.manuscriptSource') || '';
  return detectChapters(text, mode);
}

export function saveChapterWorkspace(chapters: Chapter[]) {
  const ordered = chapters.map((c, i) => ({
    ...c,
    order: i,
    updatedAt: Date.now(),
    wordCount: wc(c.content || ''),
  }));
  const manuscript = manuscriptFromChapters(ordered);
  try {
    const raw = localStorage.getItem(COMMISSION_KEY);
    const state = raw ? JSON.parse(raw) : {};
    localStorage.setItem(COMMISSION_KEY, JSON.stringify({ ...state, chapters: ordered, rawInput: manuscript }));
    localStorage.setItem('caspa.whitePage', manuscript);
    localStorage.setItem('caspa.manuscriptSource', manuscript);
    window.dispatchEvent(new CustomEvent('caspa:chapters-updated', { detail: { chapters: ordered, manuscript } }));
  } catch { /* local persistence best effort */ }
  return { chapters: ordered, manuscript };
}

export function addChapter(chapters: Chapter[], mode = 'novel') {
  const next = [...chapters, {
    id: id(), title: normaliseChapterTitle('', chapters.length, mode), summary: '', content: '',
    order: chapters.length, plotNodeIds: [], tags: [], updatedAt: Date.now(), wordCount: 0,
  } as Chapter];
  return saveChapterWorkspace(next).chapters;
}

export function renameChapter(chapters: Chapter[], chapterId: string, title: string) {
  return saveChapterWorkspace(chapters.map((c) => c.id === chapterId ? { ...c, title: normaliseChapterTitle(title, c.order) } : c)).chapters;
}

export function deleteChapter(chapters: Chapter[], chapterId: string) {
  return saveChapterWorkspace(chapters.filter((c) => c.id !== chapterId)).chapters;
}

export function moveChapter(chapters: Chapter[], chapterId: string, delta: -1 | 1) {
  const list = chapters.slice().sort((a, b) => a.order - b.order);
  const idx = list.findIndex((c) => c.id === chapterId);
  const target = idx + delta;
  if (idx < 0 || target < 0 || target >= list.length) return list;
  [list[idx], list[target]] = [list[target], list[idx]];
  return saveChapterWorkspace(list).chapters;
}
