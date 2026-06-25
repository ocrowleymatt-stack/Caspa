import { buildShowstopperBundle } from '../showstopper';
import { requireProject } from '../../shared/elevationHelpers';

export class PosterCopyGenerator {
  async generate(projectId: string) {
    const project = await requireProject(projectId);
    const bundle = buildShowstopperBundle(project.title, project.description);
    return { projectId, lines: bundle.posterLines, layout: 'Title dominant, tagline below, mood image full bleed', generatedAt: new Date().toISOString() };
  }
}

export const posterCopyGenerator = new PosterCopyGenerator();
