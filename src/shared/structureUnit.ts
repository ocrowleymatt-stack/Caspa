/** Canonical manuscript structure unit types (stored on Chapter records). */

export type StructureUnitType =
  | 'part'
  | 'chapter'
  | 'scene'
  | 'act'
  | 'sequence'
  | 'section'
  | 'essay'
  | 'poem'
  | 'song'
  | 'argument'
  | 'evidence'
  | 'note';

export type StructureUnitStatus =
  | 'source'
  | 'draft'
  | 'revision'
  | 'approved'
  | 'placeholder';

export type StructureSourceRole =
  | 'original'
  | 'ai-output'
  | 'applied-output'
  | 'user-written'
  | 'imported';

export const STRUCTURE_UNIT_LABELS: Record<StructureUnitType, string> = {
  part: 'Part',
  chapter: 'Chapter',
  scene: 'Scene',
  act: 'Act',
  sequence: 'Sequence',
  section: 'Section',
  essay: 'Essay',
  poem: 'Poem',
  song: 'Song',
  argument: 'Argument',
  evidence: 'Evidence',
  note: 'Note',
};

export function structureUnitLabel(unitType?: StructureUnitType): string {
  if (!unitType) return 'Unit';
  return STRUCTURE_UNIT_LABELS[unitType] ?? unitType;
}

export function isSourceManuscriptTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes('source manuscript')
    || lower.includes('uploaded manuscript')
    || lower.startsWith('source white page')
    || lower.startsWith('imported manuscript');
}

export function isAiRevisionTitle(title: string): boolean {
  return title.toLowerCase().startsWith('manuscript improvement');
}

export function inferUnitTypeFromTitle(title: string): StructureUnitType {
  const lower = title.toLowerCase().trim();
  if (/^act\s+/i.test(lower)) return 'act';
  if (/^scene\s+/i.test(lower)) return 'scene';
  if (/^(?:int\.|ext\.)/i.test(lower)) return 'scene';
  if (/^part\s+/i.test(lower)) return 'part';
  if (/^chapter\s+/i.test(lower) || /^ch\.?\s+/i.test(lower)) return 'chapter';
  if (/^essay\s+/i.test(lower)) return 'essay';
  if (/^song|^reprise/i.test(lower)) return 'song';
  if (/^(?:prologue|epilogue|introduction)\b/i.test(lower)) return 'section';
  return 'chapter';
}

export function mapDetectedUnitType(
  detected: string,
  fallback: StructureUnitType = 'chapter',
): StructureUnitType {
  const allowed: StructureUnitType[] = [
    'part', 'chapter', 'scene', 'act', 'sequence', 'section',
    'essay', 'poem', 'song', 'argument', 'evidence', 'note',
  ];
  return allowed.includes(detected as StructureUnitType)
    ? (detected as StructureUnitType)
    : fallback;
}
