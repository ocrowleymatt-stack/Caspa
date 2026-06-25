const INSPIRATION_CLICHES = [
  /in the style of/i,
  /sounds like/i,
  /similar to/i,
  /copy of/i,
  /exactly like/i,
];

export interface GuardResult {
  allowed: boolean;
  warnings: string[];
  sanitizedPrompt: string;
}

export class MusicInspirationGuard {
  guard(prompt: string): GuardResult {
    const warnings: string[] = [];
    for (const pattern of INSPIRATION_CLICHES) {
      if (pattern.test(prompt)) {
        warnings.push('Avoid direct artist/composer comparisons — describe mood and instrumentation instead.');
      }
    }
    const sanitizedPrompt = prompt
      .replace(/in the style of [^.]+/gi, 'with a distinctive original character')
      .replace(/sounds like [^.]+/gi, 'evoking a similar emotional tone');

    return {
      allowed: warnings.length < 3,
      warnings,
      sanitizedPrompt: sanitizedPrompt.trim(),
    };
  }
}

export const musicInspirationGuard = new MusicInspirationGuard();
