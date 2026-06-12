/**
 * Research Library Service
 * Manages factual research: geography, history, timelines, worldbuilding
 */

import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, onSnapshot } from 'firebase/firestore';

export interface ResearchEntry {
  id?: string;
  projectId: string;
  category: 'geography' | 'history' | 'timeline' | 'worldbuilding' | 'science' | 'culture' | 'other';
  topic: string;
  content: string;
  sources: {
    title: string;
    url?: string;
    author?: string;
    publicationDate?: string;
  }[];
  tags: string[];
  linkedCharacters: string[]; // character IDs
  linkedManuscriptSections: number[]; // word counts where this research appears
  verificationStatus: 'unverified' | 'verified' | 'contradicted';
  notes: string;
  createdAt: number;
  updatedAt: number;
}

class ResearchLibrary {
  private db: any;
  private projectId: string = '';

  constructor() {
    this.db = getFirestore();
  }

  setProjectId(projectId: string) {
    this.projectId = projectId;
  }

  async addResearchEntry(entry: Omit<ResearchEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<ResearchEntry> {
    if (!this.projectId) throw new Error('Project ID not set');

    const now = Date.now();
    const docRef = await addDoc(collection(this.db, 'research'), {
      ...entry,
      createdAt: now,
      updatedAt: now,
    });

    return { ...entry, id: docRef.id, createdAt: now, updatedAt: now };
  }

  async updateResearchEntry(entryId: string, updates: Partial<ResearchEntry>) {
    const ref = doc(this.db, 'research', entryId);
    await updateDoc(ref, {
      ...updates,
      updatedAt: Date.now(),
    });
  }

  async deleteResearchEntry(entryId: string) {
    const ref = doc(this.db, 'research', entryId);
    await deleteDoc(ref);
  }

  async getResearchByProject(projectId: string): Promise<ResearchEntry[]> {
    const q = query(collection(this.db, 'research'), where('projectId', '==', projectId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResearchEntry));
  }

  async getResearchByCategory(projectId: string, category: ResearchEntry['category']): Promise<ResearchEntry[]> {
    const q = query(
      collection(this.db, 'research'),
      where('projectId', '==', projectId),
      where('category', '==', category)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResearchEntry));
  }

  async searchResearch(projectId: string, searchTerm: string): Promise<ResearchEntry[]> {
    const entries = await this.getResearchByProject(projectId);
    const term = searchTerm.toLowerCase();
    return entries.filter(
      entry =>
        entry.topic.toLowerCase().includes(term) ||
        entry.content.toLowerCase().includes(term) ||
        entry.tags.some(tag => tag.toLowerCase().includes(term))
    );
  }

  subscribeToResearch(projectId: string, callback: (entries: ResearchEntry[]) => void) {
    const q = query(collection(this.db, 'research'), where('projectId', '==', projectId));
    return onSnapshot(q, snapshot => {
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResearchEntry));
      callback(entries);
    });
  }

  /**
   * Link research to manuscript section (by word count)
   */
  async linkToManuscript(entryId: string, wordCount: number) {
    const ref = doc(this.db, 'research', entryId);
    const entry = (await getDocs(query(collection(this.db, 'research'))))[0];
    const currentLinks = entry.data().linkedManuscriptSections || [];
    if (!currentLinks.includes(wordCount)) {
      currentLinks.push(wordCount);
      await updateDoc(ref, { linkedManuscriptSections: currentLinks });
    }
  }

  /**
   * Validate timeline consistency
   * Checks for contradictions in dates/events
   */
  async validateTimeline(projectId: string): Promise<{ valid: boolean; contradictions: string[] }> {
    const timeline = await this.getResearchByCategory(projectId, 'timeline');
    const contradictions: string[] = [];

    // Simple validation - can be enhanced with more complex logic
    // For now, flag duplicate dates
    const dates = timeline.map(t => ({ date: t.topic, id: t.id }));
    const seen = new Set<string>();
    dates.forEach(d => {
      if (seen.has(d.date)) {
        contradictions.push(`Duplicate timeline entry: ${d.date}`);
      }
      seen.add(d.date);
    });

    return {
      valid: contradictions.length === 0,
      contradictions,
    };
  }

  /**
   * Validate character consistency with research
   */
  async validateCharacterConsistency(characterId: string, projectId: string): Promise<{ issues: string[] }> {
    const issues: string[] = [];
    // Check if character's timeline aligns with historical research
    // Implementation would depend on character data structure
    return { issues };
  }
}

export const researchLibrary = new ResearchLibrary();
