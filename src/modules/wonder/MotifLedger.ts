import { deleteById, generateId, readCollection, upsert, type MotifEntry } from '../../shared';
import { NotFoundError } from '../manuscript';

const COLLECTION = 'motifs';

export class MotifLedger {
  async list(projectId?: string): Promise<MotifEntry[]> {
    const items = await readCollection<MotifEntry>(COLLECTION);
    return projectId ? items.filter((m) => m.projectId === projectId) : items;
  }

  async get(id: string): Promise<MotifEntry> {
    const items = await readCollection<MotifEntry>(COLLECTION);
    const motif = items.find((m) => m.id === id);
    if (!motif) throw new NotFoundError(`Motif not found: ${id}`);
    return motif;
  }

  async create(data: Omit<MotifEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MotifEntry> {
    const now = new Date().toISOString();
    const motif: MotifEntry = { ...data, id: generateId(), createdAt: now, updatedAt: now };
    return upsert(COLLECTION, motif);
  }

  async update(id: string, data: Partial<MotifEntry>): Promise<MotifEntry> {
    const existing = await this.get(id);
    const updated: MotifEntry = { ...existing, ...data, id, updatedAt: new Date().toISOString() };
    return upsert(COLLECTION, updated);
  }

  async remove(id: string): Promise<boolean> {
    return deleteById(COLLECTION, id);
  }
}

export const motifLedger = new MotifLedger();
