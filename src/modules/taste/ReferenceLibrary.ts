export interface ReferenceEntry {
  id: string;
  title: string;
  medium: 'novel' | 'play' | 'film' | 'musical';
  notes: string;
  tags: string[];
}

export class ReferenceLibrary {
  private readonly references: ReferenceEntry[] = [
    { id: 'ref-1', title: 'Angels in America', medium: 'play', notes: 'Epic scope, intimate dialogue', tags: ['prestige', 'political'] },
    { id: 'ref-2', title: 'The Secret History', medium: 'novel', notes: 'Lyrical dark academia', tags: ['literary', 'dark'] },
    { id: 'ref-3', title: 'Hadestown', medium: 'musical', notes: 'Myth retelling, folk score', tags: ['musical', 'myth'] },
    { id: 'ref-4', title: 'Fleabag', medium: 'film', notes: 'Fourth-wall intimacy, comedy-drama', tags: ['intimate', 'comedy'] },
    { id: 'ref-5', title: 'Hamilton', medium: 'musical', notes: 'Historical remix, high pace', tags: ['spectacle', 'commercial'] },
  ];

  list(tags?: string[]): ReferenceEntry[] {
    if (!tags?.length) return this.references;
    return this.references.filter((r) => tags.some((t) => r.tags.includes(t)));
  }
}

export const referenceLibrary = new ReferenceLibrary();
