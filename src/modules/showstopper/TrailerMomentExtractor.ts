import { buildShowstopperBundle } from './SignatureMomentFinder';
import { getProjectFullText, requireProject } from '../../shared/elevationHelpers';
import type { ShowstopperBundle } from '../../shared/types';

export class TrailerMomentExtractor {
  async extract(projectId: string): Promise<ShowstopperBundle & { moments: { timestamp: string; description: string }[] }> {
    await getProjectFullText(projectId);
    const project = await requireProject(projectId);
    const bundle = buildShowstopperBundle(project.title, project.description);
    return {
      ...bundle,
      moments: [
        { timestamp: '0:00-0:15', description: 'Title card over opening image' },
        { timestamp: '0:15-0:45', description: bundle.trailerLines[0] ?? 'Hook line' },
        { timestamp: '0:45-1:30', description: 'Rapid montage of emotional peaks' },
        { timestamp: '1:30-2:00', description: bundle.trailerLines[2] ?? 'Stakes line' },
        { timestamp: '2:00-end', description: 'Title + release date' },
      ],
    };
  }
}

export const trailerMomentExtractor = new TrailerMomentExtractor();
