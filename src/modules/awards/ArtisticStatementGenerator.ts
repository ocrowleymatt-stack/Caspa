import { aiWithFallback, requireProject } from '../../shared/elevationHelpers';

export class ArtisticStatementGenerator {
  async generate(projectId: string) {
    const project = await requireProject(projectId);
    const { text } = await aiWithFallback(
      'Write a first-person artistic statement for the author.',
      `${project.title}: ${project.description}`,
      `I write to illuminate the spaces between what we say and what we mean. ${project.title} is my attempt to hold that tension with honesty and humour.`,
      projectId,
    );
    return { projectId, statement: text, generatedAt: new Date().toISOString() };
  }
}

export const artisticStatementGenerator = new ArtisticStatementGenerator();
