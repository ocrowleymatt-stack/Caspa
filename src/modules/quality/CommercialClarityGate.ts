import type { QualityGateStatus } from '../../shared/types';
import type { GateResult } from './OutputQualityGate';

export class CommercialClarityGate {
  check(text: string): GateResult {
    const hasHook = text.slice(0, 500).split(/[.!?]/).some((s) => s.trim().length > 20);
    const hasConflict = /\b(but|however|until|must|cannot|won't)\b/i.test(text.slice(0, 2000));
    const score = Math.round((hasHook ? 45 : 20) + (hasConflict ? 45 : 15));
    let status: QualityGateStatus = 'PASS';
    if (score < 50) status = 'REVISE';
    else if (score < 70) status = 'PASS_WITH_WARNINGS';

    return {
      gate: 'CommercialClarityGate',
      status,
      score,
      issues: !hasHook ? ['Opening lacks clear hook'] : !hasConflict ? ['Stakes unclear in opening pages'] : [],
      notes: ['Ensure logline-level clarity within first 500 words'],
    };
  }
}

export const commercialClarityGate = new CommercialClarityGate();
