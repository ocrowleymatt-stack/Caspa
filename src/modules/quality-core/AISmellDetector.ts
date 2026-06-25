import { qualityOrchestrator } from '../quality/qualityOrchestrator';

export interface AISmellResult {
  score: number;
  status: 'natural' | 'mixed' | 'ai_heavy';
  signals: string[];
  delegatedFrom: string[];
}

const AI_PATTERNS = [
  /in today's (world|society|fast-paced)/i,
  /it's worth noting/i,
  /delve into/i,
  /tapestry of/i,
  /multifaceted/i,
  /it's important to (note|remember)/i,
  /as an ai/i,
  /in conclusion,/i,
  /furthermore,/i,
];

export class AISmellDetector {
  detect(text: string): AISmellResult {
    const signals: string[] = [];
    for (const pattern of AI_PATTERNS) {
      if (pattern.test(text)) {
        signals.push(`Pattern match: ${pattern.source}`);
      }
    }

    const qualityResult = qualityOrchestrator.checkText(text);
    const clicheGate = qualityResult.gates.find((g) => g.gate === 'ClicheDetector');
    if (clicheGate && clicheGate.score < 70) {
      signals.push('Cliche detector flagged generic phrasing');
    }

    const score = Math.max(0, 100 - signals.length * 15 - (100 - qualityResult.overallScore) * 0.3);
    const status = score >= 75 ? 'natural' : score >= 45 ? 'mixed' : 'ai_heavy';

    return {
      score: Math.round(score),
      status,
      signals,
      delegatedFrom: ['qualityOrchestrator', 'ClicheDetector'],
    };
  }
}

export const aiSmellDetector = new AISmellDetector();
