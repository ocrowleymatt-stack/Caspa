import { generateId, writeJsonFile, readJsonFile, listJsonFiles } from '../../shared/fileStore';

export type OutputType =
  | 'document'
  | 'music_prompt'
  | 'confidence_certificate'
  | 'product_plan'
  | 'illustration_brief'
  | 'command_result'
  | 'novel-write-pro'
  | 'gold-pass'
  | 'continue-writing'
  | 'project-bible'
  | 'manuscript-improvement'
  | 'other';

export interface OutputRecord {
  id: string;
  projectId?: string;
  type: OutputType;
  title: string;
  path: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export class OutputRegistry {
  private subPath = 'outputs';

  async register(opts: Omit<OutputRecord, 'id' | 'createdAt'>): Promise<OutputRecord> {
    const record: OutputRecord = {
      ...opts,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    await writeJsonFile(this.subPath, `${record.id}.json`, record);
    return record;
  }

  async get(id: string): Promise<OutputRecord | null> {
    return readJsonFile<OutputRecord>(this.subPath, `${id}.json`);
  }

  async list(opts?: { projectId?: string; type?: OutputType }): Promise<OutputRecord[]> {
    const files = await listJsonFiles(this.subPath);
    const records: OutputRecord[] = [];
    for (const file of files) {
      const r = await readJsonFile<OutputRecord>(this.subPath, file);
      if (!r) continue;
      if (opts?.projectId && r.projectId !== opts.projectId) continue;
      if (opts?.type && r.type !== opts.type) continue;
      records.push(r);
    }
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export const outputRegistry = new OutputRegistry();
