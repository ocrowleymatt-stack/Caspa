import { generateId, readCollection, upsert } from '../../shared';

export interface PreferenceEntry {
  id: string;
  profileId: string;
  action: 'apply' | 'compare' | 'extract';
  snippet: string;
  rating?: number;
  createdAt: string;
}

const COLLECTION = 'taste-preferences';

export class PreferenceMemory {
  async record(entry: Omit<PreferenceEntry, 'id' | 'createdAt'>): Promise<PreferenceEntry> {
    const full: PreferenceEntry = { ...entry, id: generateId(), createdAt: new Date().toISOString() };
    return upsert(COLLECTION, full);
  }

  async listForProfile(profileId: string): Promise<PreferenceEntry[]> {
    const items = await readCollection<PreferenceEntry>(COLLECTION);
    return items.filter((e) => e.profileId === profileId).slice(-20);
  }
}

export const preferenceMemory = new PreferenceMemory();
