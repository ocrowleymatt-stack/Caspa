import { showFactoryService } from '../show-factory';

export interface CastabilityScore {
  showPackageId: string;
  overall: number;
  roles: { role: string; difficulty: number; notes: string }[];
  ensembleSize: number;
  generatedAt: string;
}

export class CastabilityScorer {
  async score(showPackageId: string): Promise<CastabilityScore> {
    const pkg = await showFactoryService.getShowPackage(showPackageId);
    const text = pkg.components.join('\n');
    const roles = [...new Set((text.match(/\b[A-Z][A-Z\s]+:/g) ?? []).map((s) => s.replace(':', '').trim()))];
    const cast = roles.length ? roles.slice(0, 10) : ['LEAD', 'ANTAGONIST', 'ENSEMBLE'];

    return {
      showPackageId,
      overall: Math.min(100, 70 + cast.length * 2),
      roles: cast.map((role, i) => ({
        role,
        difficulty: Math.min(100, 40 + i * 8 + (text.includes(role) ? 10 : 0)),
        notes: i === 0 ? 'Requires range — comedy and pathos' : 'Strong supporting presence',
      })),
      ensembleSize: Math.max(4, cast.length + 2),
      generatedAt: new Date().toISOString(),
    };
  }
}

export const castabilityScorer = new CastabilityScorer();
