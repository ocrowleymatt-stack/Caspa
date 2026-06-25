import { aiWithFallback, requireProject } from '../../shared/elevationHelpers';

export class SubmissionStatementWriter {
  async write(projectId: string) {
    const project = await requireProject(projectId);
    const { text } = await aiWithFallback(
      'Write a 200-word festival submission statement.',
      project.description,
      `${project.title} explores themes of identity, belonging, and transformation through ${project.genre} storytelling.`,
      projectId,
    );
    return { projectId, statement: text, wordCount: text.split(/\s+/).length, generatedAt: new Date().toISOString() };
  }
}

export const submissionStatementWriter = new SubmissionStatementWriter();
