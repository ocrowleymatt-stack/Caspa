import type { QualityGateStatus } from '../../shared/types';
import type { GateResult } from './OutputQualityGate';

const CLICHES = [
  'at the end of the day',
  'needless to say',
  'in this day and age',
  'think outside the box',
  'it goes without saying',
  'time will tell',
  'little did they know',
  'suddenly',
  'very unique',
  'couldn\'t help but',
];

export class ClicheDetector {
  check(text: string): GateResult {
    const lower = text.toLowerCase();
    const found = CLICHES.filter((c) => lower.includes(c));
    const score = Math.max(0, 100 - found.length * 12);
    let status: QualityGateStatus = 'PASS';
    if (found.length >= 5) status = 'REVISE';
    else if (found.length >= 2) status = 'PASS_WITH_WARNINGS';

    return {
      gate: 'ClicheDetector',
      status,
      score,
      issues: found.map((c) => `Cliché detected: "${c}"`),
      notes: found.length === 0 ? ['No common clichés detected'] : ['Replace flagged phrases with specific imagery'],
    };
  }
}

export const clicheDetector = new ClicheDetector();
