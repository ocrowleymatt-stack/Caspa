import { buildShowstopperBundle } from '../showstopper';
import { requireProject } from '../../shared/elevationHelpers';

export class TrailerScriptGenerator {
  async generate(projectId: string) {
    const project = await requireProject(projectId);
    const bundle = buildShowstopperBundle(project.title, project.description);
    return {
      projectId,
      duration: '2:00',
      scenes: bundle.trailerLines.map((line, i) => ({
        order: i + 1,
        visual: `Montage beat ${i + 1}`,
        audio: line,
        duration: '15s',
      })),
      generatedAt: new Date().toISOString(),
    };
  }
}

export const trailerScriptGenerator = new TrailerScriptGenerator();
