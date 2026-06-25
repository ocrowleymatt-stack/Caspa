import type { QualityGateStatus } from '../../shared/types';
import type { GateResult } from './OutputQualityGate';

const SENSITIVE = ['slur-placeholder', 'graphic torture', 'real person defamation'];

export class RightsAndSafetyGate {
  check(text: string): GateResult {
    const lower = text.toLowerCase();
    const flags = SENSITIVE.filter((s) => lower.includes(s));
    const hasRealNames = /\b(prime minister|president \w+|celebrity)\b/i.test(text);
    let status: QualityGateStatus = 'PASS';
    if (flags.length > 0) status = 'BLOCK';
    else if (hasRealNames) status = 'PASS_WITH_WARNINGS';

    return {
      gate: 'RightsAndSafetyGate',
      status,
      score: flags.length ? 20 : hasRealNames ? 70 : 95,
      issues: flags.map((f) => `Safety flag: ${f}`),
      notes: hasRealNames ? ['Verify fictionalisation of real figures'] : ['No major rights/safety flags'],
    };
  }
}

export const rightsAndSafetyGate = new RightsAndSafetyGate();
