import { generateId, writeJsonFile, readJsonFile, listJsonFiles } from '../../shared/fileStore';
import type { ClassifiedSource } from './SourceClassifier';

export interface SourceRecord {
  id: string;
  projectId?: string;
  filename?: string;
  content: string;
  classification: ClassifiedSource;
  potentialScore: number;
  createdAt: string;
}

export class SourceLedger {
  private subPath = 'sources';

  async record(opts: {
    content: string;
    classification: ClassifiedSource;
    potentialScore: number;
    projectId?: string;
    filename?: string;
  }): Promise<SourceRecord> {
    const record: SourceRecord = {
      id: generateId(),
      projectId: opts.projectId,
      filename: opts.filename,
      content: opts.content,
      classification: opts.classification,
      potentialScore: opts.potentialScore,
      createdAt: new Date().toISOString(),
    };
    await writeJsonFile(this.subPath, `${record.id}.json`, record);
    return record;
  }

  async get(id: string): Promise<SourceRecord | null> {
    return readJsonFile<SourceRecord>(this.subPath, `${id}.json`);
  }

  async list(projectId?: string): Promise<SourceRecord[]> {
    const files = await listJsonFiles(this.subPath);
    const records: SourceRecord[] = [];
    for (const file of files) {
      const r = await readJsonFile<SourceRecord>(this.subPath, file);
      if (r && (!projectId || r.projectId === projectId)) records.push(r);
    }
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export const sourceLedger = new SourceLedger();
