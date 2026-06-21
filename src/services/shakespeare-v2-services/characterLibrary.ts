/**
 * Character Library Service
 * Manages character creation, persistence, and arc tracking through manuscript passes
 */

import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, onSnapshot } from 'firebase/firestore';

export interface Character {
  id?: string;
  projectId: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor' | 'unused';
  backstory: string;
  physicalTraits: string;
  psychologicalTraits: string;
  motivations: string;
  fears: string;
  secrets: string;
  arcProgression: {
    pass1?: string;
    pass2?: string;
    pass3?: string;
    pass4?: string;
    pass5?: string;
  };
  firstAppearance: number; // word count
  relationships: {
    characterId: string;
    characterName: string;
    relationship: string;
  }[];
  psychologicalInfluence: {
    technique: string; // e.g., "vulnerability shift", "moral ambiguity", "growth catalyst"
    target: string; // reader emotion/belief to influence
    mechanism: string; // how the character creates this influence
  }[];
  createdAt: number;
  updatedAt: number;
}

class CharacterLibrary {
  private db: any;
  private projectId: string = '';

  constructor() {
    this.db = getFirestore();
  }

  setProjectId(projectId: string) {
    this.projectId = projectId;
  }

  async createCharacter(character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>): Promise<Character> {
    if (!this.projectId) throw new Error('Project ID not set');

    const now = Date.now();
    const docRef = await addDoc(collection(this.db, 'characters'), {
      ...character,
      createdAt: now,
      updatedAt: now,
    });

    return { ...character, id: docRef.id, createdAt: now, updatedAt: now };
  }

  async updateCharacter(characterId: string, updates: Partial<Character>) {
    if (!this.projectId) throw new Error('Project ID not set');

    const ref = doc(this.db, 'characters', characterId);
    await updateDoc(ref, {
      ...updates,
      updatedAt: Date.now(),
    });
  }

  async updateCharacterArc(characterId: string, pass: 1 | 2 | 3 | 4 | 5, arcDescription: string) {
    const ref = doc(this.db, 'characters', characterId);
    await updateDoc(ref, {
      [`arcProgression.pass${pass}`]: arcDescription,
      updatedAt: Date.now(),
    });
  }

  async deleteCharacter(characterId: string) {
    const ref = doc(this.db, 'characters', characterId);
    await deleteDoc(ref);
  }

  async getCharacters(projectId: string): Promise<Character[]> {
    const q = query(collection(this.db, 'characters'), where('projectId', '==', projectId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Character));
  }

  async getCharacterById(characterId: string): Promise<Character | null> {
    const ref = doc(this.db, 'characters', characterId);
    const snapshot = await getDocs(query(collection(this.db, 'characters'), where('id', '==', characterId)));
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Character;
  }

  subscribeToCharacters(projectId: string, callback: (characters: Character[]) => void) {
    const q = query(collection(this.db, 'characters'), where('projectId', '==', projectId));
    return onSnapshot(q, snapshot => {
      const characters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Character));
      callback(characters);
    });
  }

  /**
   * Generate psychological influence insights from character traits
   * Suggests how this character can influence reader psychology
   */
  async analyzeCharacterInfluence(character: Character): Promise<{ technique: string; target: string; mechanism: string }[]> {
    // This would call the AI service to generate psychological influence techniques
    // For now, return a template
    return [
      {
        technique: 'Vulnerability Shift',
        target: 'Reader Empathy',
        mechanism: `${character.name}'s ${character.fears} creates reader identification`,
      },
      {
        technique: 'Moral Ambiguity',
        target: 'Reader Belief Shift',
        mechanism: `${character.name}'s ${character.secrets} challenges reader assumptions`,
      },
    ];
  }

  /**
   * Suggest character relationships based on story structure
   */
  async suggestRelationships(character: Character, allCharacters: Character[]): Promise<Character[]> {
    return allCharacters.filter(c => c.id !== character.id);
  }
}

export const characterLibrary = new CharacterLibrary();
