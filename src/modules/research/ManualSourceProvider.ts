import { generateId, writeJsonFile, readJsonFile } from '../../shared/fileStore';

export interface ManualSource {
  id: string;
  title: string;
  url?: string;
  notes: string;
  projectId?: string;
  createdAt: string;
}

export class ManualSourceProvider {
  private subPath = 'sources';

  async add(opts: { title: string; url?: string; notes: string; projectId?: string }): Promise<ManualSource> {
    const source: ManualSource = {
      id: generateId(),
      title: opts.title,
      url: opts.url,
      notes: opts.notes,
      projectId: opts.projectId,
      createdAt: new Date().toISOString(),
    };
    await writeJsonFile(this.subPath, `manual-${source.id}.json`, source);
    return source;
  }

  async get(id: string): Promise<ManualSource | null> {
    return readJsonFile<ManualSource>(this.subPath, `manual-${id}.json`);
  }
}

export const manualSourceProvider = new ManualSourceProvider();
