import { aiOrchestrator } from '../ai';
import { outputRegistry } from '../outputs';
import {
  buildNovelWriteProAutoWritePrompt,
  type NovelWriteProMode,
} from './novelWritePro';

export interface NovelWriteProRequest {
  projectId?: string;
  mode?: NovelWriteProMode;
  output?: string;
  spark?: string;
  source?: string;
  tone?: string;
  uploadedName?: string | null;
  modeTitle?: string;
  genre?: string;
}

export interface NovelWriteProResult {
  outputId: string;
  projectId?: string;
  title: string;
  kind: 'novel-write-pro';
  text: string;
  provider: string;
  model: string;
  createdAt: string;
}

const modeTitles: Record<NovelWriteProMode, string> = {
  novel: 'Novel',
  script: 'Script',
  musical: 'Musical / Show',
  adaptation: 'Adaptation',
  polish: 'Polish',
  chaos: 'Chaos',
};

const modeGenres: Record<NovelWriteProMode, string> = {
  novel: 'Novel',
  script: 'Stage / Screen Script',
  musical: 'Musical Theatre / Show',
  adaptation: 'Adaptation',
  polish: 'Manuscript Polish',
  chaos: 'Experimental',
};

function draftTitle(mode: NovelWriteProMode, output: string): string {
  if (mode === 'script') {
    return output === 'Act One' ? 'Act One — Novel Write Pro Draft' : 'Opening Scene — Novel Write Pro Draft';
  }
  if (mode === 'musical') return 'Opening Number / Show Draft';
  if (mode === 'adaptation') return 'Adaptation Opening — Novel Write Pro Draft';
  if (mode === 'polish') return 'Award Pass Rewrite';
  if (mode === 'chaos') return 'High-Voltage Opening — Novel Write Pro Draft';
  return 'Chapter One — Novel Write Pro Draft';
}

function inferProvider(model: string): string {
  const lower = model.toLowerCase();
  if (lower.includes('mistral') || lower.includes('llama') || lower.includes('gemma')) {
    return 'ollama';
  }
  if (lower.includes('gemini')) return 'gemini';
  if (lower.includes('gpt') || lower.includes('openai')) return 'openai';
  if (lower.includes('claude') || lower.includes('anthropic')) return 'anthropic';
  if (lower.includes('grok')) return 'grok';
  return 'cloud';
}

export class NovelWriteProService {
  async generate(body: NovelWriteProRequest): Promise<NovelWriteProResult> {
    const mode = body.mode ?? 'script';
    const output = body.output ?? 'Act One';
    const modeTitle = body.modeTitle ?? modeTitles[mode];
    const genre = body.genre ?? modeGenres[mode];
    const premise = body.spark ?? '';
    const tone = body.tone ?? 'Clear, vivid, witty, production-minded.';
    const sourceText = body.source ?? '';

    const prompt = buildNovelWriteProAutoWritePrompt({
      mode,
      modeTitle,
      genre,
      premise,
      tone,
      output,
      sourceText,
      uploadedName: body.uploadedName,
    });

    const response = await aiOrchestrator.generate({
      prompt,
      projectId: body.projectId,
      temperature: 0.88,
      maxTokens: 5200,
    });

    const text = response.text.trim();
    if (!text) {
      throw new Error(
        'Novel Write Pro connected to an AI engine but returned no writing. Check Ollama on the server or cloud billing.',
      );
    }

    const title = draftTitle(mode, output);
    const provider = inferProvider(response.model);
    const record = await outputRegistry.register({
      projectId: body.projectId,
      type: 'novel-write-pro',
      title,
      path: '',
      metadata: {
        kind: 'novel-write-pro',
        text,
        provider,
        model: response.model,
        mode,
        output,
        spark: premise,
        tone,
      },
    });

    return {
      outputId: record.id,
      projectId: body.projectId,
      title,
      kind: 'novel-write-pro',
      text,
      provider,
      model: response.model,
      createdAt: record.createdAt,
    };
  }
}

export const novelWriteProService = new NovelWriteProService();
