import {
  deleteById,
  findById,
  generateId,
  readCollection,
  upsert,
  type Character,
} from '../../shared';
import { NotFoundError } from './ProjectService';

const CHARACTERS = 'characters';

export class CharacterService {
  async listCharacters(projectId: string): Promise<Character[]> {
    const characters = await readCollection<Character>(CHARACTERS);
    return characters.filter((character) => character.projectId === projectId);
  }

  async getCharacter(id: string): Promise<Character> {
    const character = await findById<Character>(CHARACTERS, id);
    if (!character) {
      throw new NotFoundError(`Character not found: ${id}`);
    }
    return character;
  }

  async createCharacter(data: Omit<Character, 'id'>): Promise<Character> {
    const character: Character = {
      ...data,
      id: generateId(),
      traits: data.traits ?? [],
      relationships: data.relationships ?? [],
    };

    await upsert(CHARACTERS, character);
    return character;
  }

  async updateCharacter(id: string, data: Partial<Character>): Promise<Character> {
    const existing = await this.getCharacter(id);
    const character: Character = {
      ...existing,
      ...data,
      id: existing.id,
      projectId: existing.projectId,
    };

    await upsert(CHARACTERS, character);
    return character;
  }

  async deleteCharacter(id: string): Promise<void> {
    await this.getCharacter(id);
    await deleteById(CHARACTERS, id);
  }

  async getCharacterRelationshipMap(projectId: string): Promise<{
    nodes: Character[];
    edges: { from: string; to: string; type: string }[];
  }> {
    const nodes = await this.listCharacters(projectId);
    const nodeIds = new Set(nodes.map((node) => node.id));

    const edges: { from: string; to: string; type: string }[] = [];
    for (const character of nodes) {
      for (const relationship of character.relationships) {
        if (nodeIds.has(relationship.characterId)) {
          edges.push({
            from: character.id,
            to: relationship.characterId,
            type: relationship.type,
          });
        }
      }
    }

    return { nodes, edges };
  }
}
