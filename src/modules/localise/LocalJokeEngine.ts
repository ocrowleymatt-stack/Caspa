import { aiWithFallback, requireProject } from '../../shared/elevationHelpers';

export interface LocalJokePack {
  region: string;
  jokes: string[];
  avoid: string[];
  generatedAt: string;
}

export class LocalJokeEngine {
  async generate(region: string, context: string, projectId?: string): Promise<LocalJokePack> {
    const { text } = await aiWithFallback(
      `Suggest 5 locally flavoured jokes/references for ${region}. Keep sponsor-safe.`,
      context.slice(0, 2000),
      `Regional humour tailored to ${region} audiences.`,
      projectId,
    );
    const jokes = text.split('\n').filter(Boolean).slice(0, 5);
    while (jokes.length < 5) jokes.push(`${region} in-joke #${jokes.length + 1}`);

    return {
      region,
      jokes,
      avoid: ['Politically divisive references', 'Outdated stereotypes', 'Unlicensed brand names'],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const localJokeEngine = new LocalJokeEngine();
