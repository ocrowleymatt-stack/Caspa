export interface SpeakabilityResult {
  score: number;
  tongueTwisters: string[];
  longLines: string[];
  suggestions: string[];
}

export class DialogueSpeakability {
  check(text: string): SpeakabilityResult {
    const lines = text.split('\n').filter((l) => l.includes(':'));
    const longLines = lines.filter((l) => l.length > 120).slice(0, 5);
    const tongueTwisters = lines.filter((l) => /(\b\w*(s|sh|ch|th)\w*\b.*){4,}/i.test(l)).slice(0, 5);
    const score = Math.max(0, 100 - longLines.length * 8 - tongueTwisters.length * 10);

    return {
      score,
      tongueTwisters,
      longLines,
      suggestions: [
        'Break lines over 120 characters at natural pauses',
        'Read aloud for alliterative clusters',
        'Mark breath points for emotional beats',
      ],
    };
  }
}

export const dialogueSpeakability = new DialogueSpeakability();
