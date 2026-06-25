import { buildShowstopperBundle } from '../showstopper';
import { requireProject } from '../../shared/elevationHelpers';

export class PullQuoteSelector {
  async select(projectId: string) {
    const project = await requireProject(projectId);
    const bundle = buildShowstopperBundle(project.title, project.description);
    return {
      projectId,
      quotes: [...bundle.posterLines.slice(0, 3), ...bundle.finalLines],
      recommended: bundle.posterLines[0],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const pullQuoteSelector = new PullQuoteSelector();
