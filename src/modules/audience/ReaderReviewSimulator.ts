import { aiWithFallback, getProjectFullText } from '../../shared/elevationHelpers';

export interface SimulatedReview {
  outlet: string;
  rating: number;
  headline: string;
  body: string;
  pullQuote: string;
}

export class ReaderReviewSimulator {
  async simulate(projectId: string): Promise<SimulatedReview[]> {
    const text = await getProjectFullText(projectId);
    const outlets = ['The Guardian', 'Goodreads Top Reviewer', 'Broadway World', 'TLS'];

    return Promise.all(
      outlets.map(async (outlet, i) => {
        const { text: body } = await aiWithFallback(
          `Write a 3-sentence review for ${outlet}.`,
          text.slice(0, 4000),
          `A compelling work with strong character work and memorable set pieces.`,
          projectId,
        );
        return {
          outlet,
          rating: Math.min(5, 3 + (i % 3)),
          headline: `${outlet}: A work of notable ambition`,
          body,
          pullQuote: body.split('.')[0] ?? 'A memorable journey',
        };
      }),
    );
  }
}

export const readerReviewSimulator = new ReaderReviewSimulator();
