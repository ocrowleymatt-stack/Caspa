export type SourceType =
  | 'manuscript'
  | 'note'
  | 'receipt'
  | 'url'
  | 'audio_transcript'
  | 'image_description'
  | 'unknown';

export interface ClassifiedSource {
  type: SourceType;
  confidence: number;
  labels: string[];
  summary: string;
}

export class SourceClassifier {
  classify(content: string, filename?: string): ClassifiedSource {
    const lower = content.toLowerCase();
    const ext = filename?.split('.').pop()?.toLowerCase() ?? '';

    if (ext === 'pdf' || /invoice|receipt|total|£|\$/.test(content)) {
      return { type: 'receipt', confidence: 0.8, labels: ['financial', 'receipt'], summary: 'Financial or receipt document detected' };
    }
    if (/https?:\/\//.test(content)) {
      return { type: 'url', confidence: 0.85, labels: ['web', 'link'], summary: 'Web URL or link reference' };
    }
    if (lower.includes('chapter') || lower.length > 500) {
      return { type: 'manuscript', confidence: 0.75, labels: ['prose', 'manuscript'], summary: 'Manuscript or long-form prose' };
    }
    if (lower.length < 200) {
      return { type: 'note', confidence: 0.7, labels: ['note', 'snippet'], summary: 'Short note or snippet' };
    }
    return { type: 'unknown', confidence: 0.4, labels: ['unclassified'], summary: 'Source type could not be determined' };
  }
}

export const sourceClassifier = new SourceClassifier();
