import { readCollection, findById } from '../../shared';
import type { Chapter, Project } from '../../shared';
import { readJsonFile, writeJsonFile } from '../../shared/fileStore';
import { buildCreativeSpecPrompt } from '../../shared/creativeSpecPrompt';
import { productionBriefService } from '../studio/ProductionBriefService';
import { aiOrchestrator } from '../ai';
import { outputRegistry } from '../outputs';

export interface ProjectBibleCharacter {
  name: string;
  role: string;
  wound: string;
  desire: string;
}

export interface ProjectBible {
  projectId: string;
  premise: string;
  genre: string;
  tone: string;
  intendedAudience: string;
  characters: ProjectBibleCharacter[];
  setting: string;
  themes: string[];
  structure: string;
  sourceNotes: string;
  styleRules: string[];
  formatDecision: string;
  scenePlan: string[];
  characterWoundMap: string;
  lastOutputIds: string[];
  updatedAt: string;
}

const SUB_PATH = 'project-bibles';

function emptyBible(projectId: string): ProjectBible {
  return {
    projectId,
    premise: '',
    genre: '',
    tone: '',
    intendedAudience: '',
    characters: [],
    setting: '',
    themes: [],
    structure: '',
    sourceNotes: '',
    styleRules: [],
    formatDecision: '',
    scenePlan: [],
    characterWoundMap: '',
    lastOutputIds: [],
    updatedAt: new Date().toISOString(),
  };
}

function bibleFilename(projectId: string): string {
  return `${projectId}.json`;
}

export class ProjectBibleService {
  async get(projectId: string): Promise<ProjectBible> {
    const stored = await readJsonFile<ProjectBible>(SUB_PATH, bibleFilename(projectId));
    if (stored) {
      return stored;
    }
    return this.buildStarter(projectId);
  }

  async patch(projectId: string, patch: Partial<ProjectBible>): Promise<ProjectBible> {
    const current = await this.get(projectId);
    const next: ProjectBible = {
      ...current,
      ...patch,
      projectId,
      updatedAt: new Date().toISOString(),
    };
    await writeJsonFile(SUB_PATH, bibleFilename(projectId), next);
    return next;
  }

  async mergeFromNovelWritePro(
    projectId: string,
    data: Partial<ProjectBible> & { outputId?: string },
  ): Promise<ProjectBible> {
    const current = await this.get(projectId);
    const lastOutputIds = [...current.lastOutputIds];
    if (data.outputId && !lastOutputIds.includes(data.outputId)) {
      lastOutputIds.unshift(data.outputId);
    }

    return this.patch(projectId, {
      premise: data.premise || current.premise,
      genre: data.genre || current.genre,
      tone: data.tone || current.tone,
      intendedAudience: data.intendedAudience || current.intendedAudience,
      characters: data.characters?.length ? data.characters : current.characters,
      setting: data.setting || current.setting,
      themes: data.themes?.length ? data.themes : current.themes,
      structure: data.structure || current.structure,
      sourceNotes: data.sourceNotes || current.sourceNotes,
      styleRules: data.styleRules?.length ? data.styleRules : current.styleRules,
      formatDecision: data.formatDecision || current.formatDecision,
      scenePlan: data.scenePlan?.length ? data.scenePlan : current.scenePlan,
      characterWoundMap: data.characterWoundMap || current.characterWoundMap,
      lastOutputIds: lastOutputIds.slice(0, 12),
    });
  }

  async generate(projectId: string): Promise<ProjectBible> {
    const project = await findById<Project>('projects', projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const chapters = (await readCollection<Chapter>('chapters'))
      .filter((ch) => ch.projectId === projectId)
      .sort((a, b) => a.order - b.order);

    const outputs = await outputRegistry.list({ projectId });
    const excerpt = chapters
      .slice(0, 3)
      .map((ch) => `### ${ch.title}\n${ch.content.slice(0, 2500)}`)
      .join('\n\n');

    const outputNotes = outputs
      .slice(0, 5)
      .map((o) => `- ${o.title} (${o.type})`)
      .join('\n');

    const brief = await productionBriefService.get(projectId).catch(() => null);
    const creativeSpec = buildCreativeSpecPrompt(brief);

    const prompt = `You are Caspa Project Bible generator. Create a concise project bible as JSON only.

PROJECT
Title: ${project.title}
Genre: ${project.genre}
Description: ${project.description}

MANUSCRIPT EXCERPT
${excerpt || '[No chapters yet]'}

RECENT OUTPUTS
${outputNotes || '[None yet]'}

${creativeSpec ? `CREATIVE TARGET\n${creativeSpec}\n` : ''}
Return valid JSON with keys:
premise, genre, tone, intendedAudience, characters (array of {name, role, wound, desire}),
setting, themes (array), structure, sourceNotes, styleRules (array), formatDecision,
scenePlan (array of scene/chapter beats), characterWoundMap (string summary)

No markdown fences. JSON only.`;

    const response = await aiOrchestrator.generateWithContext(
      { prompt, temperature: 0.4, maxTokens: 2800 },
      projectId,
    );

    const parsed = parseJsonObject(response.text);
    const starter = await this.buildStarter(projectId);

    const bible = await this.patch(projectId, {
      premise: stringField(parsed.premise, starter.premise || project.description),
      genre: stringField(parsed.genre, project.genre),
      tone: stringField(parsed.tone, starter.tone),
      intendedAudience: stringField(parsed.intendedAudience, starter.intendedAudience),
      characters: parseCharacters(parsed.characters, starter.characters),
      setting: stringField(parsed.setting, starter.setting),
      themes: stringArray(parsed.themes, starter.themes),
      structure: stringField(parsed.structure, starter.structure),
      sourceNotes: stringField(parsed.sourceNotes, starter.sourceNotes),
      styleRules: stringArray(parsed.styleRules, starter.styleRules),
      formatDecision: stringField(parsed.formatDecision, starter.formatDecision),
      scenePlan: stringArray(parsed.scenePlan, starter.scenePlan),
      characterWoundMap: stringField(parsed.characterWoundMap, starter.characterWoundMap),
    });

    await outputRegistry.register({
      projectId,
      type: 'project-bible',
      title: `Project Bible — ${project.title}`,
      path: '',
      metadata: {
        kind: 'project-bible',
        bible,
        provider: response.model.includes('mistral') || response.model.includes('llama') ? 'ollama' : 'cloud',
        model: response.model,
        destination: 'writing-history',
      },
    });

    return bible;
  }

  private async buildStarter(projectId: string): Promise<ProjectBible> {
    const project = await findById<Project>('projects', projectId);
    const bible = emptyBible(projectId);
    if (!project) {
      return bible;
    }

    bible.premise = project.description?.split('\n')[0]?.trim() ?? '';
    bible.genre = project.genre ?? '';
    bible.tone = 'Clear, vivid, witty, production-minded.';
    bible.intendedAudience = 'Literary and commercial readers seeking distinctive voice.';
    bible.structure = `${project.title} — draft in progress`;
    bible.sourceNotes = project.description ?? '';

    const chapters = (await readCollection<Chapter>('chapters'))
      .filter((ch) => ch.projectId === projectId)
      .sort((a, b) => a.order - b.order);

    if (chapters.length > 0) {
      bible.scenePlan = chapters.map((ch, i) => `${i + 1}. ${ch.title}`);
    }

    await writeJsonFile(SUB_PATH, bibleFilename(projectId), bible);
    return bible;
  }
}

function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence?.[1]) {
      try {
        return JSON.parse(fence[1].trim()) as Record<string, unknown>;
      } catch {
        /* fall through */
      }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        /* fall through */
      }
    }
  }
  return {};
}

function stringField(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    if (items.length) return items;
  }
  return fallback;
}

function parseCharacters(
  value: unknown,
  fallback: ProjectBibleCharacter[],
): ProjectBibleCharacter[] {
  if (!Array.isArray(value)) return fallback;
  const chars = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      if (!name) return null;
      return {
        name,
        role: typeof row.role === 'string' ? row.role : '',
        wound: typeof row.wound === 'string' ? row.wound : '',
        desire: typeof row.desire === 'string' ? row.desire : '',
      };
    })
    .filter((item): item is ProjectBibleCharacter => item !== null);
  return chars.length ? chars : fallback;
}

export const projectBibleService = new ProjectBibleService();
