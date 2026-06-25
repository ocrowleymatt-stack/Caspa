import { aiWithFallback } from '../../shared/elevationHelpers';
import type { TasteProfile } from '../../shared';

export interface StyleDNA {
  warmth: number;
  wit: number;
  darkness: number;
  lyricism: number;
  pace: number;
  commerciality: number;
  authenticity: number;
  spectacle: number;
  intimacy: number;
  summary: string;
}

export class StyleDNAExtractor {
  async extract(text: string, projectId?: string): Promise<StyleDNA> {
    const words = text.split(/\s+/).filter(Boolean);
    const avgLen = words.reduce((s, w) => s + w.length, 0) / Math.max(words.length, 1);
    const exclamations = (text.match(/!/g) ?? []).length;
    const questions = (text.match(/\?/g) ?? []).length;

    const dna: StyleDNA = {
      warmth: Math.min(100, Math.round(40 + (text.match(/\b(love|heart|kind|warm)\b/gi) ?? []).length * 5)),
      wit: Math.min(100, Math.round(30 + exclamations * 3 + questions * 2)),
      darkness: Math.min(100, Math.round(30 + (text.match(/\b(death|fear|dark|blood|shadow)\b/gi) ?? []).length * 6)),
      lyricism: Math.min(100, Math.round(35 + avgLen * 4)),
      pace: Math.min(100, Math.round(50 + words.length / 100)),
      commerciality: Math.min(100, Math.round(45 + (text.slice(0, 500).includes('?') ? 15 : 0))),
      authenticity: Math.min(100, Math.round(60 + (text.match(/\b(I|we|my)\b/g) ?? []).length)),
      spectacle: Math.min(100, Math.round(25 + (text.match(/\b(explosion|crowd|stage|lights)\b/gi) ?? []).length * 10)),
      intimacy: Math.min(100, Math.round(50 + (text.match(/\b(whisper|touch|close|alone)\b/gi) ?? []).length * 8)),
      summary: '',
    };

    const { text: summary } = await aiWithFallback(
      'Describe the style DNA of this text in one sentence.',
      text.slice(0, 4000),
      `Style skews lyricism ${dna.lyricism}, pace ${dna.pace}, intimacy ${dna.intimacy}.`,
      projectId,
    );
    dna.summary = summary;
    return dna;
  }

  distance(a: StyleDNA | TasteProfile['controls'], b: StyleDNA | TasteProfile['controls']): number {
    const keys = ['warmth', 'wit', 'darkness', 'lyricism', 'pace', 'commerciality', 'authenticity', 'spectacle', 'intimacy'] as const;
    const diffs = keys.map((k) => Math.abs((a as StyleDNA)[k] - (b as StyleDNA)[k]));
    return Math.round(100 - diffs.reduce((s, d) => s + d, 0) / keys.length);
  }
}

export const styleDNAExtractor = new StyleDNAExtractor();
