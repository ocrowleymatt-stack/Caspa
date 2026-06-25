export type ProductType =
  | 'novel'
  | 'audiobook'
  | 'stage_show'
  | 'musical'
  | 'podcast'
  | 'graphic_novel'
  | 'short_story_collection';

export interface ProductRecommendation {
  type: ProductType;
  score: number;
  rationale: string;
  nextSteps: string[];
}

export class ProductTypeEngine {
  recommend(opts: {
    genre?: string;
    wordCount?: number;
    hasMusic?: boolean;
    targetAudience?: string;
  }): ProductRecommendation[] {
    const recs: ProductRecommendation[] = [];
    const wc = opts.wordCount ?? 80000;

    recs.push({
      type: 'novel',
      score: wc >= 50000 ? 90 : 70,
      rationale: 'Primary manuscript format — natural starting point',
      nextSteps: ['Run quality gates', 'Build EPUB', 'Check publish confidence'],
    });

    if (opts.hasMusic || /musical|music|song/i.test(opts.genre ?? '')) {
      recs.push({
        type: 'musical',
        score: 85,
        rationale: 'Music elements detected — musical adaptation viable',
        nextSteps: ['Open Music Prompt Lab', 'Generate show package'],
      });
    }

    recs.push({
      type: 'audiobook',
      score: wc >= 30000 ? 75 : 50,
      rationale: 'Audiobook extends reach for literary fiction',
      nextSteps: ['Cast table read', 'Plan narration pacing'],
    });

    recs.push({
      type: 'stage_show',
      score: /theatre|drama|play|show/i.test(opts.genre ?? '') ? 80 : 55,
      rationale: 'Stage adaptation potential based on genre',
      nextSteps: ['Show Factory packaging', 'Rehearsal notes'],
    });

    return recs.sort((a, b) => b.score - a.score);
  }
}

export const productTypeEngine = new ProductTypeEngine();
