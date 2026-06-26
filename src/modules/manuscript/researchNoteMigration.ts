import { readCollection, upsert, type ResearchNote } from '../../shared';

const RESEARCH_NOTES = 'research-notes';

export function normalizeResearchNote(note: ResearchNote): ResearchNote {
  return {
    ...note,
    tags: note.tags ?? [],
    verificationStatus: note.verificationStatus ?? 'unverified',
    sourceType: note.sourceType ?? (note.tags?.includes('imported') ? 'imported' : 'user'),
    attachments: note.attachments ?? [],
    metadata: note.metadata ?? {},
    updatedAt: note.updatedAt ?? note.createdAt,
  };
}

export async function migrateResearchNotesModel(): Promise<number> {
  const notes = await readCollection<ResearchNote>(RESEARCH_NOTES);
  let updated = 0;

  for (const note of notes) {
    const normalized = normalizeResearchNote(note);
    if (note.verificationStatus && note.sourceType && note.updatedAt) {
      continue;
    }
    await upsert(RESEARCH_NOTES, normalized);
    updated += 1;
  }

  return updated;
}
