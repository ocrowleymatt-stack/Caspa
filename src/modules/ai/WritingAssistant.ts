import { findById, generateId, readCollection } from '../../shared';
import type { Character, Chapter, PlotPoint, Project } from '../../shared';
import { AIOrchestrator, aiOrchestrator } from './AIOrchestrator';

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? text.trim();
  return JSON.parse(candidate) as T;
}

export class WritingAssistant {
  constructor(private readonly orchestrator: AIOrchestrator = aiOrchestrator) {}

  async continueChapter(chapterId: string, instruction?: string): Promise<string> {
    const chapter = await findById<Chapter>('chapters', chapterId);
    if (!chapter) {
      throw new Error(`Chapter not found: ${chapterId}`);
    }

    const tail = chapter.content.slice(-2000);
    const prompt = instruction
      ? `${instruction}\n\nContinue from:\n${tail}`
      : `Continue writing this chapter naturally from where it left off:\n${tail}`;

    const response = await this.orchestrator.generateWithContext(
      { prompt, chapterId, projectId: chapter.projectId, maxTokens: 2048 },
      chapter.projectId,
    );
    return response.text.trim();
  }

  async rewriteSelection(text: string, instruction: string, projectId: string): Promise<string> {
    const prompt = `Rewrite the following text according to this instruction: "${instruction}"\n\nOriginal text:\n${text}\n\nProvide only the rewritten text.`;
    const response = await this.orchestrator.generateWithContext(
      { prompt, projectId, maxTokens: 2048 },
      projectId,
    );
    return response.text.trim();
  }

  async suggestPlotPoints(projectId: string): Promise<PlotPoint[]> {
    const project = await findById<Project>('projects', projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const prompt = `Suggest 5 plot points for the novel "${project.title}" (${project.genre}). Return JSON array with objects: { "title": string, "description": string, "type": "inciting-incident"|"rising-action"|"climax"|"falling-action"|"resolution"|"other", "order": number }.`;
    const response = await this.orchestrator.generateWithContext(
      { prompt, projectId, maxTokens: 2048 },
      projectId,
    );

    const parsed = extractJson<
      { title: string; description: string; type: PlotPoint['type']; order: number }[]
    >(response.text);

    return parsed.map((item, index) => ({
      id: generateId(),
      projectId,
      title: item.title,
      description: item.description,
      type: item.type,
      order: item.order ?? index + 1,
    }));
  }

  async generateCharacterDialogue(characterId: string, situation: string): Promise<string> {
    const character = await findById<Character>('characters', characterId);
    if (!character) {
      throw new Error(`Character not found: ${characterId}`);
    }

    const prompt = `Write dialogue for ${character.name} (${character.role}) in this situation: ${situation}\n\nCharacter description: ${character.description}\nBackstory: ${character.backstory}\nTraits: ${character.traits.join(', ')}\n\nProvide natural dialogue only.`;
    const response = await this.orchestrator.generateWithContext(
      { prompt, projectId: character.projectId, maxTokens: 1024 },
      character.projectId,
    );
    return response.text.trim();
  }

  async critiqueChapter(chapterId: string): Promise<{
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  }> {
    const chapter = await findById<Chapter>('chapters', chapterId);
    if (!chapter) {
      throw new Error(`Chapter not found: ${chapterId}`);
    }

    const prompt = `Critique this chapter titled "${chapter.title}":\n\n${chapter.content}\n\nReturn JSON: { "strengths": string[], "weaknesses": string[], "suggestions": string[] }`;
    const response = await this.orchestrator.generateWithContext(
      { prompt, chapterId, projectId: chapter.projectId, maxTokens: 2048 },
      chapter.projectId,
    );

    return extractJson<{ strengths: string[]; weaknesses: string[]; suggestions: string[] }>(
      response.text,
    );
  }

  async generateChapterSummary(chapterId: string): Promise<string> {
    const chapter = await findById<Chapter>('chapters', chapterId);
    if (!chapter) {
      throw new Error(`Chapter not found: ${chapterId}`);
    }

    const prompt = `Summarize this chapter in 2-3 concise paragraphs:\n\nTitle: ${chapter.title}\n\n${chapter.content}`;
    const response = await this.orchestrator.generateWithContext(
      { prompt, chapterId, projectId: chapter.projectId, maxTokens: 512 },
      chapter.projectId,
    );
    return response.text.trim();
  }

  async checkConsistency(projectId: string): Promise<{ issues: string[]; warnings: string[] }> {
    const [project, chapters, characters] = await Promise.all([
      findById<Project>('projects', projectId),
      readCollection<Chapter>('chapters'),
      readCollection<Character>('characters'),
    ]);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const projectChapters = chapters
      .filter((chapter) => chapter.projectId === projectId)
      .sort((a, b) => a.order - b.order);
    const projectCharacters = characters.filter((character) => character.projectId === projectId);

    const manuscript = projectChapters
      .map((chapter) => `## ${chapter.title}\n${chapter.content}`)
      .join('\n\n');

    const characterList = projectCharacters
      .map((character) => `${character.name}: ${character.description}`)
      .join('\n');

    const prompt = `Review this manuscript for consistency issues.\n\nProject: ${project.title}\nCharacters:\n${characterList}\n\nManuscript:\n${manuscript.slice(0, 12000)}\n\nReturn JSON: { "issues": string[], "warnings": string[] }`;
    const response = await this.orchestrator.generateWithContext(
      { prompt, projectId, maxTokens: 2048 },
      projectId,
    );

    return extractJson<{ issues: string[]; warnings: string[] }>(response.text);
  }

  async generateTitle(projectId: string): Promise<string[]> {
    const project = await findById<Project>('projects', projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const prompt = `Suggest 5 compelling title options for this ${project.genre} novel.\nDescription: ${project.description}\n\nReturn JSON array of 5 title strings.`;
    const response = await this.orchestrator.generateWithContext(
      { prompt, projectId, maxTokens: 512 },
      projectId,
    );

    return extractJson<string[]>(response.text);
  }

  async matchWritingStyle(sampleText: string, newPrompt: string): Promise<string> {
    const prompt = `Match the writing style of this sample:\n\n${sampleText}\n\nNow write the following in the same style:\n${newPrompt}`;
    const response = await this.orchestrator.generate({ prompt, maxTokens: 2048 });
    return response.text.trim();
  }
}

export const writingAssistant = new WritingAssistant();
