import { buildCreativeSpecPrompt } from '../../shared/creativeSpecPrompt';
import { productionBriefService } from '../studio/ProductionBriefService';
import { findById } from '../../shared';
import type { Chapter } from '../../shared';
import { aiOrchestrator } from '../ai';
import { outputRegistry } from '../outputs';

export type ContinueMode =
  | 'continue'
  | 'rewrite'
  | 'expand'
  | 'polish'
  | 'punch-up'
  | 'darker'
  | 'funnier'
  | 'stage-adapt';

export interface ContinueWritingRequest {
  projectId: string;
  chapterId?: string;
  currentText: string;
  instruction?: string;
  mode?: ContinueMode;
  parentOutputId?: string;
}

export interface ContinueWritingResult {
  outputId: string;
  projectId: string;
  title: string;
  kind: 'continue-writing';
  text: string;
  provider: string;
  model: string;
  mode: ContinueMode;
  createdAt: string;
}

const modeInstructions: Record<ContinueMode, string> = {
  continue: 'Continue the prose in the same voice, rhythm and point of view. Add the next natural section.',
  rewrite: 'Rewrite the passage for clarity, tension and voice while preserving story facts.',
  expand: 'Expand with sensory detail, subtext and scene pressure without padding.',
  polish: 'Polish for award-target prose: cut sludge, sharpen images, improve rhythm.',
  'punch-up': 'Increase energy, wit and dramatic pressure while staying truthful to character.',
  darker: 'Deepen threat, wound and moral complexity without melodrama.',
  funnier: 'Increase comic timing, irony and character-driven humour.',
  'stage-adapt': 'Adapt toward stage/screen readability: clearer beats, speakable dialogue, stageable action.',
};

function inferProvider(model: string): string {
  const lower = model.toLowerCase();
  if (lower.includes('mistral') || lower.includes('llama') || lower.includes('gemma')) return 'ollama';
  if (lower.includes('gemini')) return 'gemini';
  if (lower.includes('gpt') || lower.includes('openai')) return 'openai';
  if (lower.includes('claude') || lower.includes('anthropic')) return 'anthropic';
  if (lower.includes('grok')) return 'grok';
  return 'cloud';
}

export class ContinueWritingService {
  async continue(body: ContinueWritingRequest): Promise<ContinueWritingResult> {
    if (!body.projectId?.trim()) {
      throw new Error('projectId is required');
    }
    if (!body.currentText?.trim()) {
      throw new Error('currentText is required');
    }

    const mode = body.mode ?? 'continue';
    const brief = await productionBriefService.get(body.projectId).catch(() => null);
    const creativeSpec = buildCreativeSpecPrompt(brief);
    const chapter = body.chapterId
      ? await findById<Chapter>('chapters', body.chapterId)
      : null;

    const extra = body.instruction?.trim()
      ? `\nUSER INSTRUCTION: ${body.instruction.trim()}`
      : '';

    const prompt = `You are Caspa Continue Writing.

MODE: ${mode}
DIRECTION: ${modeInstructions[mode]}${extra}
${creativeSpec ? `\n${creativeSpec}\n` : ''}

CURRENT TEXT (continue from here or transform as directed):
${body.currentText.slice(-12000)}

Return only the new or revised prose. Match established voice. No meta commentary.`;

    const response = await aiOrchestrator.generateWithContext(
      {
        prompt,
        projectId: body.projectId,
        chapterId: body.chapterId,
        temperature: mode === 'punch-up' || mode === 'funnier' ? 0.92 : 0.82,
        maxTokens: 3200,
      },
      body.projectId,
    );

    const text = response.text.trim();
    if (!text) {
      throw new Error('Continue writing returned no text. Check Ollama or cloud provider status.');
    }

    const title = chapter
      ? `${chapter.title} — ${mode} pass`
      : `Continue writing — ${mode}`;

    const provider = inferProvider(response.model);
    const record = await outputRegistry.register({
      projectId: body.projectId,
      type: 'continue-writing',
      title,
      path: '',
      metadata: {
        kind: 'continue-writing',
        text,
        mode,
        instruction: body.instruction ?? '',
        chapterId: body.chapterId,
        sourceChapterId: body.chapterId,
        parentOutputId: body.parentOutputId,
        provider,
        model: response.model,
        destination: body.chapterId ? 'beside-unit' : 'writing-history',
      },
    });

    return {
      outputId: record.id,
      projectId: body.projectId,
      title,
      kind: 'continue-writing',
      text,
      provider,
      model: response.model,
      mode,
      createdAt: record.createdAt,
    };
  }
}

export const continueWritingService = new ContinueWritingService();
