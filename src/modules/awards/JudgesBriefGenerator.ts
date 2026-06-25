import { requireProject } from '../../shared/elevationHelpers';

export class JudgesBriefGenerator {
  async generate(projectId: string) {
    const project = await requireProject(projectId);
    return {
      projectId,
      brief: `Judges should evaluate ${project.title} for emotional authenticity, structural clarity, and originality within ${project.genre}.`,
      criteria: [
        { criterion: 'Voice', weight: 25, guidance: 'Distinctive authorial perspective' },
        { criterion: 'Structure', weight: 25, guidance: 'Satisfying arc and pacing' },
        { criterion: 'Theme', weight: 25, guidance: 'Resonance and depth' },
        { criterion: 'Craft', weight: 25, guidance: 'Line-level precision' },
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const judgesBriefGenerator = new JudgesBriefGenerator();
