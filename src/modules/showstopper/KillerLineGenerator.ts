import { aiWithFallback } from '../../shared/elevationHelpers';
import { buildShowstopperBundle } from './SignatureMomentFinder';
import type { ShowstopperBundle } from '../../shared/types';

export class KillerLineGenerator {
  async generate(text: string, projectId?: string): Promise<ShowstopperBundle> {
    const { text: aiLine } = await aiWithFallback(
      'Generate one killer closing line for this work.',
      text.slice(0, 3000),
      'And for the first time, we were exactly where we needed to be.',
      projectId,
    );
    return buildShowstopperBundle('Untitled', text.slice(0, 80), {
      finalLines: [aiLine, 'Some truths only arrive at the end.', 'We begin again — together.'],
    });
  }
}

export const killerLineGenerator = new KillerLineGenerator();
