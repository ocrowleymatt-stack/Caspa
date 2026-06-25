import type { QualityGateStatus } from '../../shared/types';
import type { GateResult } from './OutputQualityGate';

export class PerformancePracticalityGate {
  check(text: string): GateResult {
    const castCount = (text.match(/\b[A-Z][a-z]+:/g) ?? []).length;
    const sceneCount = (text.match(/\b(INT\.|EXT\.|SCENE \d)/gi) ?? []).length;
    const complexFX = (text.match(/\b(explosion|helicopter|live animal|full orchestra)\b/gi) ?? []).length;
    const score = Math.max(0, Math.min(100, 90 - complexFX * 15 - Math.max(0, castCount - 20) * 2));
    let status: QualityGateStatus = 'PASS';
    if (complexFX >= 3) status = 'REVISE';
    else if (complexFX >= 1 || castCount > 25) status = 'PASS_WITH_WARNINGS';

    return {
      gate: 'PerformancePracticalityGate',
      status,
      score,
      issues: complexFX ? ['High production complexity detected'] : [],
      notes: [`~${castCount} dialogue speakers, ~${sceneCount || 'N/A'} scene markers`],
    };
  }
}

export const performancePracticalityGate = new PerformancePracticalityGate();
