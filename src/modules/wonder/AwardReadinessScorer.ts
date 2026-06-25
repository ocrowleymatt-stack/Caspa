import { getProjectChapters, getProjectFullText, requireProject, scoreFromMetrics, wordCount } from '../../shared/elevationHelpers';

export interface AwardReadinessScore {
  projectId: string;
  overall: number;
  dimensions: {
    emotionalDepth: number;
    craft: number;
    originality: number;
    thematicResonance: number;
    commercialAppeal: number;
  };
  verdict: string;
  generatedAt: string;
}

export class AwardReadinessScorer {
  async scoreProject(projectId: string): Promise<AwardReadinessScore> {
    const project = await requireProject(projectId);
    const chapters = await getProjectChapters(projectId);
    const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
    const target = project.targetWordCount || 80000;

    const emotionalDepth = Math.min(100, Math.round((chapters.filter((c) => c.status === 'final' || c.status === 'revised').length / Math.max(chapters.length, 1)) * 60 + 20));
    const craft = Math.min(100, Math.round((totalWords / target) * 50 + (project.description.length > 80 ? 25 : 10) + 15));
    const originality = Math.min(100, Math.round(40 + project.genre.length * 3 + chapters.length * 2));
    const thematicResonance = Math.min(100, Math.round(30 + wordCount(project.description) * 2 + chapters.length * 3));
    const commercialAppeal = Math.min(100, Math.round(35 + (project.title.length > 5 ? 20 : 10) + (totalWords > 50000 ? 30 : 15)));

    const dimensions = { emotionalDepth, craft, originality, thematicResonance, commercialAppeal };
    const overall = scoreFromMetrics(Object.values(dimensions));

    let verdict = 'Early draft — focus on manuscript completion';
    if (overall >= 80) verdict = 'Strong award contender — polish submission materials';
    else if (overall >= 65) verdict = 'Promising — strengthen emotional peaks and theme';
    else if (overall >= 50) verdict = 'Developing — refine craft and originality';

    return { projectId, overall, dimensions, verdict, generatedAt: new Date().toISOString() };
  }
}

export const awardReadinessScorer = new AwardReadinessScorer();
