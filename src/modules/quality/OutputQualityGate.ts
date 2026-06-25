import type { QualityGateStatus } from '../../shared/types';

export interface GateResult {
  gate: string;
  status: QualityGateStatus;
  score: number;
  issues: string[];
  notes: string[];
}

export interface QualityCheckResult {
  overallStatus: QualityGateStatus;
  overallScore: number;
  gates: GateResult[];
  generatedAt: string;
}

export function aggregateStatus(gates: GateResult[]): QualityGateStatus {
  if (gates.some((g) => g.status === 'BLOCK')) return 'BLOCK';
  if (gates.some((g) => g.status === 'REVISE')) return 'REVISE';
  if (gates.some((g) => g.status === 'PASS_WITH_WARNINGS')) return 'PASS_WITH_WARNINGS';
  return 'PASS';
}

export function aggregateScore(gates: GateResult[]): number {
  if (gates.length === 0) return 0;
  return Math.round(gates.reduce((s, g) => s + g.score, 0) / gates.length);
}
