import { buildShowstopperBundle } from './SignatureMomentFinder';
import { getProjectFullText, requireProject } from '../../shared/elevationHelpers';
import type { ShowstopperBundle } from '../../shared/types';

export class BigNumberGenerator {
  async generate(projectId: string): Promise<ShowstopperBundle & { concept: string }> {
    const project = await requireProject(projectId);
    await getProjectFullText(projectId);
    const bundle = buildShowstopperBundle(project.title, project.description);
    return {
      ...bundle,
      concept: `Act Two showpiece: ensemble number weaving "${project.title}" themes with escalating percussion and counter-melody`,
    };
  }
}

export const bigNumberGenerator = new BigNumberGenerator();
