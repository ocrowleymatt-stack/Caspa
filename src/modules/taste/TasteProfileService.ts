import { deleteById, generateId, readCollection, upsert, type TasteProfile } from '../../shared';

const COLLECTION = 'taste-profiles';

const DEFAULT_PROFILES: Omit<TasteProfile, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Literary Minimalist', description: 'Spare prose, subtext-heavy', controls: { warmth: 40, wit: 35, darkness: 55, lyricism: 45, pace: 35, commerciality: 30, authenticity: 90, spectacle: 20, intimacy: 85 }, isDefault: true },
  { name: 'Commercial Page-Turner', description: 'High pace, clear stakes', controls: { warmth: 60, wit: 50, darkness: 40, lyricism: 30, pace: 90, commerciality: 95, authenticity: 55, spectacle: 60, intimacy: 45 }, isDefault: true },
  { name: 'Dark Satirical', description: 'Sharp wit, moral ambiguity', controls: { warmth: 25, wit: 90, darkness: 85, lyricism: 40, pace: 65, commerciality: 50, authenticity: 75, spectacle: 45, intimacy: 35 }, isDefault: true },
  { name: 'Lyrical Romantic', description: 'Rich imagery, emotional sweep', controls: { warmth: 85, wit: 40, darkness: 30, lyricism: 95, pace: 45, commerciality: 55, authenticity: 80, spectacle: 50, intimacy: 90 }, isDefault: true },
  { name: 'Epic Spectacle', description: 'Grand scale, cinematic set pieces', controls: { warmth: 50, wit: 35, darkness: 60, lyricism: 55, pace: 75, commerciality: 70, authenticity: 50, spectacle: 95, intimacy: 30 }, isDefault: true },
  { name: 'Intimate Chamber', description: 'Small cast, close emotional focus', controls: { warmth: 75, wit: 45, darkness: 45, lyricism: 60, pace: 40, commerciality: 40, authenticity: 90, spectacle: 15, intimacy: 95 }, isDefault: true },
  { name: 'Broad Comedy', description: 'Big laughs, accessible tone', controls: { warmth: 80, wit: 95, darkness: 20, lyricism: 25, pace: 80, commerciality: 85, authenticity: 60, spectacle: 55, intimacy: 50 }, isDefault: true },
  { name: 'Prestige Drama', description: 'Award-calibre thematic depth', controls: { warmth: 55, wit: 40, darkness: 70, lyricism: 65, pace: 50, commerciality: 45, authenticity: 95, spectacle: 40, intimacy: 75 }, isDefault: true },
  { name: 'Genre Hybrid', description: 'Blends conventions playfully', controls: { warmth: 55, wit: 70, darkness: 50, lyricism: 45, pace: 70, commerciality: 65, authenticity: 70, spectacle: 65, intimacy: 55 }, isDefault: true },
];

export class TasteProfileService {
  async ensureDefaults(): Promise<void> {
    const existing = await readCollection<TasteProfile>(COLLECTION);
    if (existing.some((p) => p.isDefault)) return;
    const now = new Date().toISOString();
    for (const profile of DEFAULT_PROFILES) {
      await upsert(COLLECTION, { ...profile, id: generateId(), createdAt: now, updatedAt: now });
    }
  }

  async list(): Promise<TasteProfile[]> {
    await this.ensureDefaults();
    return readCollection<TasteProfile>(COLLECTION);
  }

  async get(id: string): Promise<TasteProfile | null> {
    await this.ensureDefaults();
    const items = await readCollection<TasteProfile>(COLLECTION);
    return items.find((p) => p.id === id) ?? null;
  }

  async create(data: Omit<TasteProfile, 'id' | 'createdAt' | 'updatedAt' | 'isDefault'> & { isDefault?: boolean }): Promise<TasteProfile> {
    const now = new Date().toISOString();
    const profile: TasteProfile = { ...data, isDefault: data.isDefault ?? false, id: generateId(), createdAt: now, updatedAt: now };
    return upsert(COLLECTION, profile);
  }

  async update(id: string, data: Partial<TasteProfile>): Promise<TasteProfile> {
    const existing = await this.get(id);
    if (!existing) throw new Error(`Taste profile not found: ${id}`);
    const updated = { ...existing, ...data, id, updatedAt: new Date().toISOString() };
    return upsert(COLLECTION, updated);
  }

  async remove(id: string): Promise<boolean> {
    const profile = await this.get(id);
    if (profile?.isDefault) throw new Error('Cannot delete default taste profile');
    return deleteById(COLLECTION, id);
  }
}

export const tasteProfileService = new TasteProfileService();
