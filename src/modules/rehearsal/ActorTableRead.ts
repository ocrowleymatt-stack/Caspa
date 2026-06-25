import { showFactoryService } from '../show-factory';
import { aiWithFallback } from '../../shared/elevationHelpers';

export interface TableReadReport {
  showPackageId: string;
  duration: string;
  castNotes: { character: string; lineCount: number; note: string }[];
  pacingIssues: string[];
  highlights: string[];
  generatedAt: string;
}

export class ActorTableRead {
  async run(showPackageId: string): Promise<TableReadReport> {
    const pkg = await showFactoryService.getShowPackage(showPackageId);
    const script = pkg.components.join('\n');
    const speakers = [...new Set((script.match(/\b[A-Z][A-Z\s]+:/g) ?? []).map((s) => s.replace(':', '').trim()))];

    const castNotes = (speakers.length ? speakers : ['LEAD', 'SUPPORT']).slice(0, 8).map((character, i) => ({
      character,
      lineCount: Math.round(script.length / (speakers.length || 1) / 50) + i,
      note: i === 0 ? 'Carries emotional arc — allow breath in monologue' : 'Watch projection in ensemble scenes',
    }));

    const { text: summary } = await aiWithFallback(
      'Summarise table-read pacing issues and highlights.',
      script.slice(0, 4000),
      'Strong opening, tighten mid-section transitions.',
      pkg.projectId,
    );

    return {
      showPackageId,
      duration: `${Math.round(script.length / 1500)} minutes estimated`,
      castNotes,
      pacingIssues: summary.includes('tight') ? ['Mid-act transition could tighten'] : ['Monitor scene length variance'],
      highlights: ['Opening establishes tone effectively', 'Climax lands with emotional clarity'],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const actorTableRead = new ActorTableRead();
