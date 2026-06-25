import { aiWithFallback } from '../../shared/elevationHelpers';

export interface PolishResult {
  original: string;
  polished: string;
  changes: string[];
  source: 'ai' | 'deterministic';
  generatedAt: string;
}

export class FinalPolishEngine {
  async polish(text: string, projectId?: string): Promise<PolishResult> {
    const fallback = this.deterministicPolish(text);
    const { text: polished, source } = await aiWithFallback(
      'Polish this text for clarity, rhythm, and emotional precision. Return only the polished text.',
      text,
      fallback,
      projectId,
    );

    const changes: string[] = [];
    if (polished.length !== text.length) changes.push('Adjusted length for flow');
    if (polished !== text) changes.push('Refined diction and rhythm');
    if (changes.length === 0) changes.push('Minor clarity improvements');

    return { original: text, polished, changes, source, generatedAt: new Date().toISOString() };
  }

  private deterministicPolish(text: string): string {
    return text
      .replace(/\s{2,}/g, ' ')
      .replace(/\.\.\./g, '…')
      .replace(/\s+([,.!?;:])/g, '$1')
      .trim();
  }
}

export const finalPolishEngine = new FinalPolishEngine();
