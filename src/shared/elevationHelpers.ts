import { findById, readCollection, type Chapter, type Project } from './index';
import { aiOrchestrator } from '../modules/ai';
import { NotFoundError, ProjectService } from '../modules/manuscript';
import type { AIResponse } from './types';

const projectService = new ProjectService();

export async function requireProject(projectId: string): Promise<Project> {
  return projectService.getProject(projectId);
}

export async function requireChapter(chapterId: string): Promise<Chapter> {
  const chapter = await findById<Chapter>('chapters', chapterId);
  if (!chapter) {
    throw new NotFoundError(`Chapter not found: ${chapterId}`);
  }
  return chapter;
}

export async function getProjectChapters(projectId: string): Promise<Chapter[]> {
  const chapters = await readCollection<Chapter>('chapters');
  return chapters
    .filter((chapter) => chapter.projectId === projectId)
    .sort((a, b) => a.order - b.order);
}

export async function getProjectFullText(projectId: string, maxChars = 12000): Promise<string> {
  const project = await requireProject(projectId);
  const chapters = await getProjectChapters(projectId);
  let text = `# ${project.title}\nGenre: ${project.genre}\n${project.description}\n\n`;
  for (const chapter of chapters) {
    text += `\n## ${chapter.title}\n${chapter.content}\n`;
  }
  if (text.length > maxChars) {
    return `${text.slice(0, maxChars)}\n...[truncated]`;
  }
  return text;
}

export async function aiWithFallback(
  prompt: string,
  context: string,
  fallback: string,
  projectId?: string,
): Promise<{ text: string; source: 'ai' | 'deterministic' }> {
  try {
    const response: AIResponse = projectId
      ? await aiOrchestrator.generateWithContext({ prompt, context, temperature: 0.7 }, projectId)
      : await aiOrchestrator.generate({ prompt, context, temperature: 0.7 });
    if (response.text?.trim()) {
      return { text: response.text.trim(), source: 'ai' };
    }
  } catch {
    // deterministic fallback
  }
  return { text: fallback, source: 'deterministic' };
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function scoreFromMetrics(metrics: number[]): number {
  if (metrics.length === 0) return 0;
  return Math.round(metrics.reduce((sum, value) => sum + value, 0) / metrics.length);
}
