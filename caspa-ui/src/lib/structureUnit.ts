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

export function sourceRoleLabel(role?: StructureSourceRole): string | null {
  if (!role) return null;
  const labels: Record<StructureSourceRole, string> = {
    original: 'Original',
    'ai-output': 'AI output',
    'applied-output': 'Applied revision',
    'user-written': 'User written',
    imported: 'Imported',
  };
  return labels[role] ?? role;
}
