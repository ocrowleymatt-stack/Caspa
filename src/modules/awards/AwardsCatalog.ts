import {
  deleteById,
  findById,
  generateId,
  readCollection,
  upsert,
} from '../../shared';
import type { AwardLens, CustomAwardInput } from '../../shared/awardsShelf';
import { AWARDS_SHELF_DISCLAIMER, BUILTIN_AWARD_LENSES } from '../../shared/awardsShelf';

const CUSTOM_AWARDS = 'custom-awards';

function toCustomLens(record: AwardLens): AwardLens {
  return { ...record, custom: true };
}

export class CustomAwardStore {
  async list(): Promise<AwardLens[]> {
    const records = await readCollection<AwardLens>(CUSTOM_AWARDS);
    return records.map(toCustomLens).sort((a, b) => a.name.localeCompare(b.name));
  }

  async get(id: string): Promise<AwardLens | null> {
    const record = await findById<AwardLens>(CUSTOM_AWARDS, id);
    return record ? toCustomLens(record) : null;
  }

  async create(input: CustomAwardInput): Promise<AwardLens> {
    const lens: AwardLens = {
      id: generateId(),
      name: input.name.trim(),
      category: input.category ?? 'custom',
      description: input.description.trim(),
      inspiredBy: input.inspiredBy?.trim() || 'Custom rubric lens',
      rubricFocus: input.rubricFocus.filter(Boolean),
      disclaimer: AWARDS_SHELF_DISCLAIMER,
      custom: true,
    };
    await upsert(CUSTOM_AWARDS, lens);
    return lens;
  }

  async delete(id: string): Promise<void> {
    await deleteById(CUSTOM_AWARDS, id);
  }
}

export class AwardsCatalog {
  private readonly customStore = new CustomAwardStore();

  async listAll(): Promise<AwardLens[]> {
    const custom = await this.customStore.list();
    return [...BUILTIN_AWARD_LENSES, ...custom];
  }

  async resolveByIds(ids: string[]): Promise<AwardLens[]> {
    const all = await this.listAll();
    const map = new Map(all.map((lens) => [lens.id, lens]));
    return ids.map((id) => map.get(id)).filter((lens): lens is AwardLens => Boolean(lens));
  }

  createCustom(input: CustomAwardInput) {
    return this.customStore.create(input);
  }
}

export const awardsCatalog = new AwardsCatalog();
