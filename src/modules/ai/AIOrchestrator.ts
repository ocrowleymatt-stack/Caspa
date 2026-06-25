import {
  emitEvent,
  findById,
  logger,
  readCollection,
} from '../../shared';
import type {
  AIRequest,
  AIResponse,
  Character,
  Chapter,
  Project,
  ResearchNote,
} from '../../shared';
import {
  anthropicGenerate,
  geminiGenerate,
  grokGenerate,
  isAnthropicConfigured,
  isGeminiConfigured,
  isGrokConfigured,
  isOpenAIConfigured,
  openaiGenerate,
} from './CloudProviders';
import { OllamaClient, ollamaClient } from './OllamaClient';

const MAX_CONTEXT_TOKENS = 4000;
const CHARS_PER_TOKEN = 4;

export class NoProviderAvailableError extends Error {
  constructor() {
    super('No AI provider is available. Configure Ollama or a cloud API key.');
    this.name = 'NoProviderAvailableError';
  }
}

type ProviderName = 'ollama' | 'gemini' | 'grok' | 'openai' | 'anthropic';

interface ProviderEntry {
  name: ProviderName;
  label: string;
  isLocal: boolean;
  isConfigured: () => Promise<boolean>;
  generate: (req: AIRequest) => Promise<AIResponse>;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function truncateToTokenLimit(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n...[truncated]`;
}

export class AIOrchestrator {
  private readonly ollama: OllamaClient;
  private readonly providers: ProviderEntry[];

  constructor(ollama: OllamaClient = ollamaClient) {
    this.ollama = ollama;
    this.providers = [
      {
        name: 'ollama',
        label: 'Ollama',
        isLocal: true,
        isConfigured: () => this.ollama.isAvailable(),
        generate: (req) => this.ollama.generate(req),
      },
      {
        name: 'gemini',
        label: 'Gemini',
        isLocal: false,
        isConfigured: isGeminiConfigured,
        generate: geminiGenerate,
      },
      {
        name: 'grok',
        label: 'Grok',
        isLocal: false,
        isConfigured: isGrokConfigured,
        generate: grokGenerate,
      },
      {
        name: 'openai',
        label: 'OpenAI',
        isLocal: false,
        isConfigured: isOpenAIConfigured,
        generate: openaiGenerate,
      },
      {
        name: 'anthropic',
        label: 'Anthropic',
        isLocal: false,
        isConfigured: isAnthropicConfigured,
        generate: anthropicGenerate,
      },
    ];
  }

  async generate(req: AIRequest): Promise<AIResponse> {
    emitEvent('ai:request', req);
    const errors: string[] = [];

    for (const provider of this.providers) {
      const available = await provider.isConfigured();
      if (!available) {
        continue;
      }

      try {
        logger.info(`AI generate using provider: ${provider.label}`);
        const response = await provider.generate(req);
        emitEvent('ai:response', response);
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Provider ${provider.label} failed: ${message}`);
        errors.push(`${provider.label}: ${message}`);
      }
    }

    throw new NoProviderAvailableError();
  }

  async generateWithContext(req: AIRequest, projectId: string): Promise<AIResponse> {
    const context = await this.buildProjectContext(projectId);
    return this.generate({
      ...req,
      context: context ? `${context}\n\n${req.context ?? ''}`.trim() : req.context,
      projectId,
    });
  }

  async streamGenerate(
    req: AIRequest,
    onChunk: (text: string) => void,
  ): Promise<AIResponse> {
    emitEvent('ai:request', req);

    const ollamaAvailable = await this.ollama.isAvailable();
    if (ollamaAvailable) {
      try {
        logger.info('AI stream using provider: Ollama');
        const response = await this.ollama.streamGenerate(req, onChunk);
        emitEvent('ai:response', response);
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Ollama stream failed: ${message}`);
      }
    }

    const response = await this.generate(req);
    if (response.text) {
      onChunk(response.text);
    }
    return response;
  }

  async getAvailableProviders(): Promise<
    { name: string; available: boolean; isLocal: boolean }[]
  > {
    const results = await Promise.all(
      this.providers.map(async (provider) => ({
        name: provider.label,
        available: await provider.isConfigured(),
        isLocal: provider.isLocal,
      })),
    );
    return results;
  }

  private async buildProjectContext(projectId: string): Promise<string> {
    const project = await findById<Project>('projects', projectId);
    if (!project) {
      return '';
    }

    const [chapters, characters, notes] = await Promise.all([
      readCollection<Chapter>('chapters'),
      readCollection<Character>('characters'),
      readCollection<ResearchNote>('research-notes'),
    ]);

    const projectChapters = chapters
      .filter((chapter) => chapter.projectId === projectId)
      .sort((a, b) => b.order - a.order)
      .slice(0, 3)
      .reverse();

    const projectCharacters = characters.filter((character) => character.projectId === projectId);
    const projectNotes = notes.filter((note) => note.projectId === projectId);

    let context = `You are assisting with the novel "${project.title}". Here is the context:\n`;
    context += `\nGenre: ${project.genre}\nDescription: ${project.description}\n`;

    if (projectCharacters.length > 0) {
      context += '\nCharacters:\n';
      for (const character of projectCharacters) {
        context += `- ${character.name} (${character.role}): ${character.description}. Traits: ${character.traits.join(', ')}\n`;
      }
    }

    if (projectNotes.length > 0) {
      context += '\nResearch Notes:\n';
      for (const note of projectNotes) {
        context += `- ${note.title}: ${note.content}\n`;
      }
    }

    if (projectChapters.length > 0) {
      context += '\nRecent Chapters:\n';
      for (const chapter of projectChapters) {
        context += `\n### ${chapter.title}\n${chapter.content}\n`;
      }
    }

    while (estimateTokens(context) > MAX_CONTEXT_TOKENS && projectChapters.length > 0) {
      const removed = projectChapters.shift();
      if (!removed) {
        break;
      }
      context = context.replace(`\n### ${removed.title}\n${removed.content}\n`, '');
    }

    return truncateToTokenLimit(context, MAX_CONTEXT_TOKENS);
  }
}

export const aiOrchestrator = new AIOrchestrator();
