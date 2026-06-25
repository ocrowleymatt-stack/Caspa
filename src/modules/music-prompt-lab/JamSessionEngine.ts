import { generateId, writeJsonFile, readJsonFile } from '../../shared/fileStore';

export interface JamSession {
  id: string;
  projectId?: string;
  promptId?: string;
  participants: string[];
  notes: string[];
  status: 'active' | 'completed';
  createdAt: string;
}

export class JamSessionEngine {
  async start(opts: { projectId?: string; promptId?: string; participants?: string[] }): Promise<JamSession> {
    const session: JamSession = {
      id: generateId(),
      projectId: opts.projectId,
      promptId: opts.promptId,
      participants: opts.participants ?? ['Composer', 'Lyricist'],
      notes: ['Jam session started — add motifs and chord suggestions.'],
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    await writeJsonFile('music-prompts', `jam-${session.id}.json`, session);
    return session;
  }

  async addNote(sessionId: string, note: string): Promise<JamSession | null> {
    const session = await readJsonFile<JamSession>('music-prompts', `jam-${sessionId}.json`);
    if (!session) return null;
    session.notes.push(note);
    await writeJsonFile('music-prompts', `jam-${sessionId}.json`, session);
    return session;
  }

  async get(sessionId: string): Promise<JamSession | null> {
    return readJsonFile<JamSession>('music-prompts', `jam-${sessionId}.json`);
  }
}

export const jamSessionEngine = new JamSessionEngine();
