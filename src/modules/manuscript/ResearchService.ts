import {
  deleteById,
  findById,
  generateId,
  readCollection,
  upsert,
  type ResearchNote,
} from '../../shared';
import { NotFoundError } from './ProjectService';

const RESEARCH_NOTES = 'research-notes';

export class ResearchService {
  async listNotes(projectId: string, tags?: string[]): Promise<ResearchNote[]> {
    let notes = (await readCollection<ResearchNote>(RESEARCH_NOTES)).filter(
      (note) => note.projectId === projectId,
    );

    if (tags && tags.length > 0) {
      notes = notes.filter((note) => tags.every((tag) => note.tags.includes(tag)));
    }

    return notes;
  }

  async getNote(id: string): Promise<ResearchNote> {
    const note = await findById<ResearchNote>(RESEARCH_NOTES, id);
    if (!note) {
      throw new NotFoundError(`Research note not found: ${id}`);
    }
    return note;
  }

  async createNote(data: Omit<ResearchNote, 'id' | 'createdAt'>): Promise<ResearchNote> {
    const note: ResearchNote = {
      ...data,
      id: generateId(),
      tags: data.tags ?? [],
      createdAt: new Date().toISOString(),
    };

    await upsert(RESEARCH_NOTES, note);
    return note;
  }

  async updateNote(id: string, data: Partial<ResearchNote>): Promise<ResearchNote> {
    const existing = await this.getNote(id);
    const note: ResearchNote = {
      ...existing,
      ...data,
      id: existing.id,
      projectId: existing.projectId,
      createdAt: existing.createdAt,
    };

    await upsert(RESEARCH_NOTES, note);
    return note;
  }

  async deleteNote(id: string): Promise<void> {
    await this.getNote(id);
    await deleteById(RESEARCH_NOTES, id);
  }

  async searchNotes(projectId: string, query: string): Promise<ResearchNote[]> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return this.listNotes(projectId);
    }

    const notes = await this.listNotes(projectId);
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(normalized) ||
        note.content.toLowerCase().includes(normalized),
    );
  }
}
