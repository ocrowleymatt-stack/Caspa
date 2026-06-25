import type { ClassifiedSource } from './SourceClassifier';

export interface SourcePotential {
  score: number;
  factors: string[];
  recommendation: string;
}

export class SourcePotentialEngine {
  assess(content: string, classification: ClassifiedSource): SourcePotential {
    const factors: string[] = [];
    let score = classification.confidence * 40;

    if (content.length > 200) {
      score += 20;
      factors.push('Substantial content length');
    }
    if (classification.type === 'manuscript') {
      score += 25;
      factors.push('Manuscript material — high creative potential');
    }
    if (classification.type === 'note') {
      score += 10;
      factors.push('Note — may seed scenes or characters');
    }
    if (classification.type === 'receipt') {
      score += 5;
      factors.push('Receipt — useful for production budgeting');
    }

    score = Math.min(100, Math.round(score));
    const recommendation = score >= 70
      ? 'Integrate into project — strong creative or production value'
      : score >= 40
        ? 'Review and tag — moderate potential'
        : 'Archive or discard — low immediate value';

    return { score, factors, recommendation };
  }
}

export const sourcePotentialEngine = new SourcePotentialEngine();
