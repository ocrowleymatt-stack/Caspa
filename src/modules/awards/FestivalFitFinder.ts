import { awardReadinessScorer } from '../wonder';

export class FestivalFitFinder {
  async find(projectId: string) {
    const score = await awardReadinessScorer.scoreProject(projectId);
    return {
      projectId,
      festivals: [
        { name: 'Edinburgh Fringe', fit: score.overall, category: 'Theatre' },
        { name: 'Hay Festival', fit: Math.round(score.dimensions.craft), category: 'Literature' },
        { name: 'National Theatre Connections', fit: Math.round(score.dimensions.commercialAppeal), category: 'Youth Theatre' },
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const festivalFitFinder = new FestivalFitFinder();
