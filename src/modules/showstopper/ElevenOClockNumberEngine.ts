import { buildShowstopperBundle } from './SignatureMomentFinder';
import { requireProject } from '../../shared/elevationHelpers';
import type { ShowstopperBundle } from '../../shared/types';

export class ElevenOClockNumberEngine {
  async build(projectId: string): Promise<ShowstopperBundle & { placement: string }> {
    const project = await requireProject(projectId);
    const bundle = buildShowstopperBundle(project.title, project.description, {
      songHooks: [
        'Eleven o\'clock — and still we rise',
        'One more song before the dawn',
        'Everything we didn\'t say',
      ],
    });
    return { ...bundle, placement: 'Late Act Two — emotional pivot before finale' };
  }
}

export const elevenOClockNumberEngine = new ElevenOClockNumberEngine();
