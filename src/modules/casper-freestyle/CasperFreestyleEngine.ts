import { freestyleCommandParser } from './FreestyleCommandParser';
import { freestyleToolRouter } from './FreestyleToolRouter';
import { freestyleSessionStore, type FreestyleSession } from './FreestyleSessionStore';

export interface FreestyleResponse {
  session: FreestyleSession;
  parsed: ReturnType<typeof freestyleCommandParser.parse>;
  actions: ReturnType<typeof freestyleToolRouter.route>;
}

export class CasperFreestyleEngine {
  async start(projectId?: string): Promise<FreestyleSession> {
    return freestyleSessionStore.create(projectId);
  }

  async process(sessionId: string, input: string): Promise<FreestyleResponse> {
    const session = await freestyleSessionStore.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const now = new Date().toISOString();
    session.messages.push({ role: 'user', content: input, timestamp: now });

    const parsed = freestyleCommandParser.parse(input);
    const actions = freestyleToolRouter.route(parsed);

    session.messages.push({
      role: 'assistant',
      content: parsed.reply,
      timestamp: new Date().toISOString(),
    });

    await freestyleSessionStore.save(session);
    return { session, parsed, actions };
  }

  async continueSession(sessionId: string, input: string): Promise<FreestyleResponse> {
    return this.process(sessionId, input);
  }

  async getStatus(): Promise<{ available: boolean; version: string; message: string }> {
    return {
      available: true,
      version: '1.0.0',
      message: 'Casper Freestyle is online. Natural language command routing active.',
    };
  }
}

export const casperFreestyleEngine = new CasperFreestyleEngine();
