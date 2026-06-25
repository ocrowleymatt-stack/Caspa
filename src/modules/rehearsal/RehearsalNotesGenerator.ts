import { actorTableRead } from './ActorTableRead';
import { blockingAdvisor } from './BlockingAdvisor';
import { pacingAnalyser } from './PacingAnalyser';
import { castabilityScorer } from './CastabilityScorer';

export interface RehearsalNotesPack {
  showPackageId: string;
  directorNotes: string[];
  stageManagerNotes: string[];
  castNotes: string[];
  generatedAt: string;
}

export class RehearsalNotesGenerator {
  async generate(showPackageId: string): Promise<RehearsalNotesPack> {
    const [tableRead, blocking, pacing, castability] = await Promise.all([
      actorTableRead.run(showPackageId),
      blockingAdvisor.advise(showPackageId),
      pacingAnalyser.analyse(showPackageId),
      castabilityScorer.score(showPackageId),
    ]);

    return {
      showPackageId,
      directorNotes: [
        ...tableRead.highlights.map((h) => `Highlight: ${h}`),
        ...pacing.recommendations.map((r) => `Pacing: ${r}`),
      ],
      stageManagerNotes: blocking.trafficNotes,
      castNotes: castability.roles.map((r) => `${r.role}: ${r.notes}`),
      generatedAt: new Date().toISOString(),
    };
  }
}

export const rehearsalNotesGenerator = new RehearsalNotesGenerator();
