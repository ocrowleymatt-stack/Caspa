import {
  getDefaultsForWorkType,
  type StructureType,
  type WorkType,
} from '../../shared/workModel';

export type DetectedUnitType =
  | 'chapter'
  | 'act'
  | 'scene'
  | 'section'
  | 'essay'
  | 'poem'
  | 'note';

export type ImportConfidence = 'high' | 'medium' | 'low';

export type RecommendedImportMode =
  | 'whole-manuscript-source'
  | 'split-into-units'
  | 'single-unit'
  | 'research-notes';

export interface DetectedUnit {
  type: DetectedUnitType;
  title: string;
  startIndex: number;
  endIndex: number;
  wordCount: number;
}

export interface ImportAnalysisInput {
  filename?: string;
  rawText: string;
  declaredWorkType?: WorkType;
}

export interface ImportAnalysisResult {
  detectedWorkType: WorkType;
  confidence: ImportConfidence;
  detectedUnits: DetectedUnit[];
  recommendedImportMode: RecommendedImportMode;
  warnings: string[];
  totalWordCount: number;
  structureType: StructureType;
}

interface HeadingMatch {
  index: number;
  line: string;
  unitType: DetectedUnitType;
  score: number;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

const CHAPTER_RE =
  /^(?:chapter|ch\.?)\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i;
const PART_RE = /^part\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five)\b/i;
const PROLOGUE_RE = /^(?:prologue|epilogue|preface|foreword|introduction)\b/i;
const ACT_RE = /^act\s+(?:[ivxlcdm]+|\d+|one|two|three|four|five)\b/i;
const SCENE_RE = /^scene\s+(?:\d+|[ivxlcdm]+|one|two|three)\b/i;
const SCREENPLAY_SLUG_RE = /^(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.|EST\.)\s+/;
const SONG_RE = /^(?:song|reprise|number)\s*[:\-]/i;
const ESSAY_RE = /^(?:essay|section)\s+(?:\d+|[ivxlcdm]+)\b/i;
const POEM_BREAK_RE = /^#{1,3}\s+.+/;

function scoreTextSignals(text: string) {
  const lines = text.split('\n');
  let chapters = 0;
  let acts = 0;
  let scenes = 0;
  let sluglines = 0;
  let songs = 0;
  let parts = 0;
  let essays = 0;
  let markdownHeadings = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (CHAPTER_RE.test(trimmed) || PART_RE.test(trimmed) || PROLOGUE_RE.test(trimmed)) chapters += 1;
    if (ACT_RE.test(trimmed)) acts += 1;
    if (SCENE_RE.test(trimmed)) scenes += 1;
    if (SCREENPLAY_SLUG_RE.test(trimmed)) sluglines += 1;
    if (SONG_RE.test(trimmed)) songs += 1;
    if (ESSAY_RE.test(trimmed)) essays += 1;
    if (POEM_BREAK_RE.test(trimmed)) markdownHeadings += 1;
  }

  return { chapters, acts, scenes, sluglines, songs, parts, essays, markdownHeadings, lineCount: lines.length };
}

function detectWorkType(text: string, declared?: WorkType): { workType: WorkType; confidence: ImportConfidence } {
  if (declared) {
    return { workType: declared, confidence: 'high' };
  }

  const signals = scoreTextSignals(text);

  if (signals.sluglines >= 3) {
    return { workType: 'screenplay', confidence: signals.sluglines >= 6 ? 'high' : 'medium' };
  }
  if (signals.songs >= 2 || (signals.acts >= 1 && signals.songs >= 1)) {
    return { workType: 'musical', confidence: 'medium' };
  }
  if (signals.acts >= 1 || (signals.scenes >= 2 && signals.chapters === 0)) {
    return { workType: 'stage-play', confidence: signals.acts >= 1 ? 'high' : 'medium' };
  }
  if (signals.essays >= 2) {
    return { workType: 'essay-collection', confidence: 'medium' };
  }
  if (signals.markdownHeadings >= 3 && signals.chapters === 0 && countWords(text) < 12000) {
    return { workType: 'poetry-collection', confidence: 'low' };
  }
  if (signals.chapters >= 2 || signals.parts >= 1) {
    return { workType: 'novel', confidence: signals.chapters >= 3 ? 'high' : 'medium' };
  }
  if (PROLOGUE_RE.test(text.split('\n').find((l) => l.trim()) ?? '')) {
    return { workType: 'novel', confidence: 'low' };
  }

  return { workType: 'other', confidence: 'low' };
}

function defaultUnitType(workType: WorkType): DetectedUnitType {
  const defaults = getDefaultsForWorkType(workType);
  switch (defaults.structureType) {
    case 'acts-scenes':
      return 'scene';
    case 'essays':
      return 'essay';
    case 'poems':
      return 'poem';
    case 'research-arguments':
      return 'section';
    case 'sections':
    case 'parts':
      return 'section';
    default:
      return 'chapter';
  }
}

function collectHeadingMatches(text: string, workType: WorkType): HeadingMatch[] {
  const defaultType = defaultUnitType(workType);
  const matches: HeadingMatch[] = [];
  let offset = 0;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) {
      let unitType = defaultType;
      let score = 1;

      if (ACT_RE.test(trimmed)) {
        unitType = 'act';
        score = 3;
      } else if (SCENE_RE.test(trimmed)) {
        unitType = 'scene';
        score = 3;
      } else if (SCREENPLAY_SLUG_RE.test(trimmed)) {
        unitType = 'scene';
        score = 4;
      } else if (SONG_RE.test(trimmed)) {
        unitType = 'section';
        score = 3;
      } else if (CHAPTER_RE.test(trimmed) || PART_RE.test(trimmed) || PROLOGUE_RE.test(trimmed)) {
        unitType = 'chapter';
        score = 3;
      } else if (ESSAY_RE.test(trimmed)) {
        unitType = 'essay';
        score = 2;
      } else if (POEM_BREAK_RE.test(trimmed)) {
        unitType = 'poem';
        score = 2;
      } else if (/^[A-Z0-9 .:'"-]{4,}$/.test(trimmed) && SCREENPLAY_SLUG_RE.test(trimmed) === false) {
        // skip all-caps dialogue headers
      }

      if (score >= 2) {
        matches.push({ index: offset, line: trimmed, unitType, score });
      }
    }
    offset += line.length + 1;
  }

  return matches.sort((a, b) => a.index - b.index);
}

function buildUnits(text: string, matches: HeadingMatch[]): DetectedUnit[] {
  if (matches.length === 0) {
    return [{
      type: 'chapter',
      title: 'Imported manuscript',
      startIndex: 0,
      endIndex: text.length,
      wordCount: countWords(text),
    }];
  }

  const units: DetectedUnit[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const slice = text.slice(start, end).trim();
    if (!slice) continue;
    units.push({
      type: matches[i].unitType,
      title: matches[i].line.slice(0, 120),
      startIndex: start,
      endIndex: end,
      wordCount: countWords(slice),
    });
  }

  return units;
}

function recommendImportMode(
  units: DetectedUnit[],
  totalWordCount: number,
  workType: WorkType,
  confidence: ImportConfidence,
): RecommendedImportMode {
  if (totalWordCount < 400) {
    return 'single-unit';
  }

  const structuralUnits = units.filter((unit) => unit.type !== 'note');
  if (structuralUnits.length >= 2 && confidence !== 'low') {
    return 'split-into-units';
  }

  if (structuralUnits.length >= 3) {
    return 'split-into-units';
  }

  if (workType === 'academic-research' && totalWordCount > 800) {
    return 'research-notes';
  }

  if (totalWordCount > 1500 && structuralUnits.length <= 1) {
    return 'whole-manuscript-source';
  }

  return structuralUnits.length === 1 ? 'single-unit' : 'whole-manuscript-source';
}

export function analyseManuscriptImport(input: ImportAnalysisInput): ImportAnalysisResult {
  const rawText = input.rawText ?? '';
  const warnings: string[] = [];
  const totalWordCount = countWords(rawText);

  if (!rawText.trim()) {
    return {
      detectedWorkType: input.declaredWorkType ?? 'other',
      confidence: 'low',
      detectedUnits: [],
      recommendedImportMode: 'single-unit',
      warnings: ['No text found in upload.'],
      totalWordCount: 0,
      structureType: getDefaultsForWorkType(input.declaredWorkType ?? 'other').structureType,
    };
  }

  const { workType, confidence } = detectWorkType(rawText, input.declaredWorkType);
  const structureType = getDefaultsForWorkType(workType).structureType;
  const matches = collectHeadingMatches(rawText, workType);
  const detectedUnits = buildUnits(rawText, matches);

  if (detectedUnits.length === 1 && totalWordCount > 5000) {
    warnings.push(
      'Large upload with no clear structural headings — keeping as a whole manuscript source is safest.',
    );
  }

  if (confidence === 'low') {
    warnings.push('Work type detection is uncertain. Confirm the work type before importing.');
  }

  if (matches.length === 0 && totalWordCount > 800) {
    warnings.push('No chapter, act, or scene markers detected.');
  }

  const recommendedImportMode = recommendImportMode(detectedUnits, totalWordCount, workType, confidence);

  return {
    detectedWorkType: workType,
    confidence,
    detectedUnits,
    recommendedImportMode,
    warnings,
    totalWordCount,
    structureType,
  };
}

export function sliceUnitText(rawText: string, unit: DetectedUnit): string {
  return rawText.slice(unit.startIndex, unit.endIndex).trim();
}
