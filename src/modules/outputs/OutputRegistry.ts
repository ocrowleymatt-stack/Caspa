import { generateId, writeJsonFile, readJsonFile, listJsonFiles } from '../../shared/fileStore';
import { normalizeOutputMetadata } from '../../shared/outputSemantics';

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
  | 'pier-boards'
  | 'pier-stretch'
  | 'pier-survey'
  | 'award-assessment'
  | 'agent-swarm'
  | 'research-depth-pass'
  | 'accuracy-check'
  | 'claim-extraction'
  | 'imported-source-analysis'
  | 'export-package'
  | 'ask-casper'
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
    const metadata = normalizeOutputMetadata(opts.metadata ?? {}, {
      type: opts.type,
      requireText: false,
    });
    const record: OutputRecord = {
      ...opts,
      metadata,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    await writeJsonFile(this.subPath, `${record.id}.json`, record);
    return record;
  }

  async update(id: string, patch: Partial<Pick<OutputRecord, 'title' | 'metadata'>>): Promise<OutputRecord | null> {
    const current = await this.get(id);
    if (!current) return null;
    const metadata = patch.metadata
      ? normalizeOutputMetadata({ ...current.metadata, ...patch.metadata }, { type: current.type })
      : current.metadata;
    const updated: OutputRecord = {
      ...current,
      ...patch,
      metadata,
    };
    await writeJsonFile(this.subPath, `${updated.id}.json`, updated);
    return updated;
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
