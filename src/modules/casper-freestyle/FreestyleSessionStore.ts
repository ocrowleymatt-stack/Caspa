export interface FreestyleMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface FreestyleSession {
  id: string;
  projectId?: string;
  messages: FreestyleMessage[];
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export class FreestyleSessionStore {
  private subPath = 'freestyle-sessions';

  async create(projectId?: string): Promise<FreestyleSession> {
    const { generateId, writeJsonFile } = await import('../../shared/fileStore');
    const now = new Date().toISOString();
    const session: FreestyleSession = {
      id: generateId(),
      projectId,
      messages: [{
        role: 'system',
        content: 'Casper Freestyle ready. Tell me what you want to create or improve.',
        timestamp: now,
      }],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await writeJsonFile(this.subPath, `${session.id}.json`, session);
    return session;
  }

  async get(id: string): Promise<FreestyleSession | null> {
    const { readJsonFile } = await import('../../shared/fileStore');
    return readJsonFile<FreestyleSession>(this.subPath, `${id}.json`);
  }

  async save(session: FreestyleSession): Promise<FreestyleSession> {
    const { writeJsonFile } = await import('../../shared/fileStore');
    session.updatedAt = new Date().toISOString();
    await writeJsonFile(this.subPath, `${session.id}.json`, session);
    return session;
  }

  async list(): Promise<FreestyleSession[]> {
    const { listJsonFiles, readJsonFile } = await import('../../shared/fileStore');
    const files = await listJsonFiles(this.subPath);
    const sessions: FreestyleSession[] = [];
    for (const file of files) {
      const s = await readJsonFile<FreestyleSession>(this.subPath, file);
      if (s) sessions.push(s);
    }
    return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

export const freestyleSessionStore = new FreestyleSessionStore();
