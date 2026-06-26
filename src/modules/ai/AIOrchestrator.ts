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
  constructor(details: string[] = []) {
    const summary = details.length
      ? `No AI provider could complete the request. ${details.slice(0, 3).join(' · ')}`
      : 'No AI provider is available. Configure Ollama or a cloud API key.';
    super(summary);
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
  private lastProviderFailures = new Map<ProviderName, string>();

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
        this.lastProviderFailures.delete(provider.name);
        emitEvent('ai:response', response);
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Provider ${provider.label} failed: ${message}`);
        errors.push(`${provider.label}: ${message}`);
        this.lastProviderFailures.set(provider.name, message);
      }
    }

    throw new NoProviderAvailableError(errors);
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
    const statuses = await this.getProviderRuntimeStatus();
    return statuses.map((s) => ({
      name: s.name,
      available: s.canGenerate,
      isLocal: s.isLocal,
    }));
  }

  async getProviderRuntimeStatus(): Promise<
    {
      name: string;
      isLocal: boolean;
      configured: boolean;
      reachable: boolean;
      canGenerate: boolean;
      status:
        | 'ready'
        | 'configured'
        | 'unreachable'
        | 'quota_failed'
        | 'model_missing'
        | 'auth_failed'
        | 'not_configured';
      detail?: string;
      model?: string;
    }[]
  > {
    const results = await Promise.all(
      this.providers.map((provider) => this.probeProvider(provider)),
    );
    return results;
  }

  private classifyError(message: string): {
    status: 'quota_failed' | 'auth_failed' | 'model_missing' | 'unreachable' | 'configured';
    detail: string;
  } {
    const lower = message.toLowerCase();
    if (lower.includes('quota') || lower.includes('billing') || lower.includes('insufficient') || lower.includes('exceeded')) {
      return { status: 'quota_failed', detail: message };
    }
    if (lower.includes('api key') || lower.includes('unauthorized') || lower.includes('authentication') || lower.includes('401')) {
      return { status: 'auth_failed', detail: message };
    }
    if (lower.includes('model') && (lower.includes('not found') || lower.includes('missing') || lower.includes('no ollama models'))) {
      return { status: 'model_missing', detail: message };
    }
    if (lower.includes('econnrefused') || lower.includes('fetch failed') || lower.includes('timed out') || lower.includes('not reachable')) {
      return { status: 'unreachable', detail: message };
    }
    return { status: 'configured', detail: message };
  }

  private async probeProvider(provider: ProviderEntry): Promise<{
    name: string;
    isLocal: boolean;
    configured: boolean;
    reachable: boolean;
    canGenerate: boolean;
    status:
      | 'ready'
      | 'configured'
      | 'unreachable'
      | 'quota_failed'
      | 'model_missing'
      | 'auth_failed'
      | 'not_configured';
    detail?: string;
    model?: string;
  }> {
    const base = {
      name: provider.label,
      isLocal: provider.isLocal,
      configured: false,
      reachable: false,
      canGenerate: false,
      status: 'not_configured' as const,
    };

    let configured = false;
    try {
      configured = await provider.isConfigured();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const classified = this.classifyError(message);
      return { ...base, configured: false, detail: classified.detail, status: classified.status };
    }

    if (!configured) {
      return { ...base, configured: false, status: 'not_configured', detail: `${provider.label} is not configured.` };
    }

    if (provider.name === 'ollama') {
      try {
        const models = await this.ollama.listModels();
        const model = await this.ollama.resolveModel();
        if (models.length === 0) {
          return {
            ...base,
            configured: true,
            reachable: true,
            canGenerate: false,
            status: 'model_missing',
            detail: 'Ollama is running but no models are installed. Run: ollama pull mistral',
          };
        }
        return {
          ...base,
          configured: true,
          reachable: true,
          canGenerate: true,
          status: 'ready',
          model,
          detail: `Local Ollama ready (${model})`,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const classified = this.classifyError(message);
        return {
          ...base,
          configured: true,
          reachable: false,
          canGenerate: false,
          status: classified.status === 'configured' ? 'unreachable' : classified.status,
          detail: classified.detail,
        };
      }
    }

    return this.cloudProbeStatus(provider, configured);
  }

  private cloudProbeStatus(provider: ProviderEntry, configured: boolean): {
    name: string;
    isLocal: boolean;
    configured: boolean;
    reachable: boolean;
    canGenerate: boolean;
    status:
      | 'ready'
      | 'configured'
      | 'unreachable'
      | 'quota_failed'
      | 'model_missing'
      | 'auth_failed'
      | 'not_configured';
    detail?: string;
    model?: string;
  } {
    const base = {
      name: provider.label,
      isLocal: provider.isLocal,
      configured,
      reachable: configured,
      canGenerate: false,
      status: 'configured' as const,
      detail: `${provider.label} key present. Runtime health checked on last write attempt.`,
    };

    const lastFailure = this.lastProviderFailures.get(provider.name);
    if (!lastFailure) {
      return base;
    }

    const classified = this.classifyError(lastFailure);
    return {
      ...base,
      canGenerate: false,
      status: classified.status,
      detail: lastFailure,
    };
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
