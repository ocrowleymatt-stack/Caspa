import { getProjectChapters, requireProject, scoreFromMetrics } from '../../shared/elevationHelpers';

export interface MarketFitScore {
  projectId: string;
  overall: number;
  segments: { segment: string; score: number; rationale: string }[];
  generatedAt: string;
}

export class MarketFitScorer {
  async score(projectId: string): Promise<MarketFitScore> {
    const project = await requireProject(projectId);
    const chapters = await getProjectChapters(projectId);
    const wordCount = chapters.reduce((s, c) => s + c.wordCount, 0);

    const segments = [
      { segment: 'Trade Fiction', score: Math.min(100, 40 + Math.round(wordCount / 2000)), rationale: 'Based on length and genre positioning' },
      { segment: 'Book Club', score: Math.min(100, 50 + project.description.length / 10), rationale: 'Discussion-friendly themes' },
      { segment: 'Theatre Adaptation', score: Math.min(100, 35 + chapters.length * 4), rationale: 'Scene density and dialogue potential' },
      { segment: 'Streaming/Film', score: Math.min(100, 45 + (project.genre.includes('thriller') ? 20 : 10)), rationale: 'Visual and dramatic potential' },
    ];

    return {
      projectId,
      overall: scoreFromMetrics(segments.map((s) => s.score)),
      segments,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const marketFitScorer = new MarketFitScorer();
