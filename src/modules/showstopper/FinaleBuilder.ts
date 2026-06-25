import { buildShowstopperBundle } from './SignatureMomentFinder';
import { requireProject } from '../../shared/elevationHelpers';
import type { ShowstopperBundle } from '../../shared/types';

export class FinaleBuilder {
  async build(projectId: string): Promise<ShowstopperBundle & { structure: string[] }> {
    const project = await requireProject(projectId);
    const bundle = buildShowstopperBundle(project.title, project.description);
    return {
      ...bundle,
      structure: [
        'Quiet reprise of opening motif',
        'Confrontation — all threads converge',
        'Release — ensemble final image',
      ],
    };
  }
}

export const finaleBuilder = new FinaleBuilder();
