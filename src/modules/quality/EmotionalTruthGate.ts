import type { QualityGateStatus } from '../../shared/types';
import type { GateResult } from './OutputQualityGate';

export class EmotionalTruthGate {
  check(text: string): GateResult {
    const emotionalWords = ['feel', 'heart', 'fear', 'love', 'grief', 'hope', 'shame', 'joy', 'anger', 'tears'];
    const lower = text.toLowerCase();
    const hits = emotionalWords.filter((w) => lower.includes(w)).length;
    const tellRatio = (lower.match(/\b(felt|was \w+ing)\b/g) ?? []).length;
    const score = Math.min(100, Math.round(40 + hits * 4 - tellRatio * 3));
    let status: QualityGateStatus = 'PASS';
    if (score < 40) status = 'REVISE';
    else if (score < 65) status = 'PASS_WITH_WARNINGS';

    return {
      gate: 'EmotionalTruthGate',
      status,
      score,
      issues: tellRatio > 5 ? ['High "telling" ratio — show emotions through action'] : [],
      notes: ['Balance emotional vocabulary with concrete behaviour'],
    };
  }
}

export const emotionalTruthGate = new EmotionalTruthGate();
