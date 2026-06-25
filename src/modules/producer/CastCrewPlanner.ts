import { showFactoryService } from '../show-factory';

export interface CastCrewPlan {
  showPackageId: string;
  cast: { role: string; type: 'principal' | 'supporting' | 'ensemble' }[];
  crew: { role: string; count: number }[];
  generatedAt: string;
}

export class CastCrewPlanner {
  async plan(showPackageId: string): Promise<CastCrewPlan> {
    const pkg = await showFactoryService.getShowPackage(showPackageId);
    const text = pkg.components.join('\n');
    const roles = [...new Set((text.match(/\b[A-Z][A-Z\s]+:/g) ?? []).map((s) => s.replace(':', '').trim()))];

    return {
      showPackageId,
      cast: (roles.length ? roles : ['LEAD', 'SUPPORT', 'ENSEMBLE']).slice(0, 8).map((role, i) => ({
        role,
        type: i === 0 ? 'principal' : i < 3 ? 'supporting' : 'ensemble',
      })),
      crew: [
        { role: 'Director', count: 1 },
        { role: 'Stage Manager', count: 1 },
        { role: 'Lighting Designer', count: 1 },
        { role: 'Sound Designer', count: 1 },
        { role: 'Stage Crew', count: 4 },
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const castCrewPlanner = new CastCrewPlanner();
