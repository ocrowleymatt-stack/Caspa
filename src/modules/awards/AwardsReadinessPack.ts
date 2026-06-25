import { awardReadinessScorer } from '../wonder';
import { requireProject } from '../../shared/elevationHelpers';

export class AwardsReadinessPack {
  async build(projectId: string) {
    const [project, score] = await Promise.all([
      requireProject(projectId),
      awardReadinessScorer.scoreProject(projectId),
    ]);
    return {
      projectId,
      title: project.title,
      score: score.overall,
      checklist: [
        { item: 'Artist statement', done: score.overall > 50 },
        { item: 'Work sample (20 pages)', done: project.currentWordCount > 5000 },
        { item: 'Synopsis (500 words)', done: project.description.length > 200 },
        { item: 'Bio and credits', done: false },
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const awardsReadinessPack = new AwardsReadinessPack();
