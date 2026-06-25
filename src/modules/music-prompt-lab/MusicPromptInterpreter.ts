import { generateId, writeJsonFile, readJsonFile } from '../../shared/fileStore';
import { musicInspirationGuard } from './MusicInspirationGuard';

export interface InterpretedPrompt {
  id: string;
  raw: string;
  sanitized: string;
  genre: string;
  mood: string;
  tempo: number;
  instrumentation: string[];
  warnings: string[];
  createdAt: string;
}

export class MusicPromptInterpreter {
  interpret(raw: string): Omit<InterpretedPrompt, 'id' | 'createdAt'> {
    const guard = musicInspirationGuard.guard(raw);
    const lower = guard.sanitizedPrompt.toLowerCase();

    let genre = 'theatrical';
    if (/ballad|slow|tender/i.test(lower)) genre = 'ballad';
    else if (/upbeat|fast|energetic/i.test(lower)) genre = 'upbeat';
    else if (/ambient|atmospheric/i.test(lower)) genre = 'ambient';

    let mood = 'reflective';
    if (/dark|melanchol|sad/i.test(lower)) mood = 'melancholic';
    else if (/joy|happy|bright/i.test(lower)) mood = 'uplifting';
    else if (/tense|suspense/i.test(lower)) mood = 'tense';

    const tempo = /fast|upbeat|energetic/i.test(lower) ? 140 : /slow|ballad/i.test(lower) ? 72 : 108;

    const instrumentation: string[] = ['piano'];
    if (/strings|violin|cello/i.test(lower)) instrumentation.push('strings');
    if (/brass|trumpet|horn/i.test(lower)) instrumentation.push('brass');
    if (/guitar/i.test(lower)) instrumentation.push('guitar');
    if (/drums|percussion/i.test(lower)) instrumentation.push('percussion');

    return {
      raw,
      sanitized: guard.sanitizedPrompt,
      genre,
      mood,
      tempo,
      instrumentation,
      warnings: guard.warnings,
    };
  }

  async save(interpreted: Omit<InterpretedPrompt, 'id' | 'createdAt'>): Promise<InterpretedPrompt> {
    const full: InterpretedPrompt = {
      ...interpreted,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    await writeJsonFile('music-prompts', `${full.id}.json`, full);
    return full;
  }

  async get(id: string): Promise<InterpretedPrompt | null> {
    return readJsonFile<InterpretedPrompt>('music-prompts', `${id}.json`);
  }
}

export const musicPromptInterpreter = new MusicPromptInterpreter();
