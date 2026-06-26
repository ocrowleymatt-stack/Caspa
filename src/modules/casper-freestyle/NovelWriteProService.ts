import { aiOrchestrator } from '../ai';
import { projectBibleService } from '../manuscript/ProjectBibleService';
import { outputRegistry } from '../outputs';
import {
  buildNovelWriteProAutoWritePrompt,
  type NovelWriteProMode,
} from './novelWritePro';
import {
  buildCriticPrompt,
  buildFirstDraftPrompt,
  buildPlanningPrompt,
  buildRewritePrompt,
  parseStructuredPlan,
  type StructuredPlan,
} from './structuredPipeline';

export interface NovelWriteProRequest {
  projectId?: string;
  chapterId?: string;
  sourceChapterTitle?: string;
  improveExisting?: boolean;
  mode?: NovelWriteProMode;
  output?: string;
  spark?: string;
  source?: string;
  tone?: string;
  uploadedName?: string | null;
  modeTitle?: string;
  genre?: string;
}

export interface NovelWriteProStructuredArtifacts {
  projectBible: StructuredPlan;
  premise: string;
  formatDecision: string;
  characterWoundMap: string;
  scenePlan: string[];
  firstDraft: string;
  criticReport: string;
  improvedRewrite: string;
}

export interface NovelWriteProResult {
  outputId: string;
  projectId?: string;
  title: string;
  kind: 'novel-write-pro' | 'manuscript-improvement';
  text: string;
  provider: string;
  model: string;
  createdAt: string;
  structured: NovelWriteProStructuredArtifacts;
  sourceChapterId?: string;
  sourceChapterTitle?: string;
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
    const improveExisting = Boolean(body.improveExisting && body.projectId?.trim());

    if (improveExisting && !sourceText.trim()) {
      throw new Error('Source manuscript text is required when improving an existing project.');
    }

    if (improveExisting && !body.projectId?.trim()) {
      throw new Error('projectId is required when improveExisting is true.');
    }

    const promptInput = {
      mode,
      modeTitle,
      genre,
      premise,
      tone,
      output,
      sourceText,
      uploadedName: body.uploadedName,
    };

    const generateOpts = {
      projectId: body.projectId,
      temperature: 0.88,
      maxTokens: 4200,
    };

    const planResponse = await aiOrchestrator.generate({
      ...generateOpts,
      prompt: buildPlanningPrompt(promptInput),
      temperature: 0.45,
      maxTokens: 2200,
    });

    const plan = parseStructuredPlan(planResponse.text, {
      premise: premise || 'A fresh original story with immediate pressure.',
      genre,
      tone,
      formatDecision: `${modeTitle} — ${output}`,
      characterWoundMap: 'Protagonist carries a hidden wound driving every scene.',
      scenePlan: [`Opening beat for ${output}`, 'Escalation', 'Reversal', 'Cost', 'Resonant image ending'],
    });

    const draftResponse = await aiOrchestrator.generate({
      ...generateOpts,
      prompt: buildFirstDraftPrompt(promptInput, plan),
    });
    const firstDraft = draftResponse.text.trim();
    if (!firstDraft) {
      throw new Error(
        'Novel Write Pro planning succeeded but first draft was empty. Check Ollama or cloud billing.',
      );
    }

    const criticResponse = await aiOrchestrator.generate({
      ...generateOpts,
      prompt: buildCriticPrompt(plan, firstDraft),
      temperature: 0.35,
      maxTokens: 1800,
    });
    const criticReport = criticResponse.text.trim() || 'Critic room: strengthen hook, scene turns and subtext.';

    const rewriteResponse = await aiOrchestrator.generate({
      ...generateOpts,
      prompt: buildRewritePrompt(promptInput, plan, firstDraft, criticReport),
    });
    const improvedRewrite = rewriteResponse.text.trim() || firstDraft;

    const model = rewriteResponse.model || draftResponse.model || planResponse.model;
    const provider = inferProvider(model);
    const isManuscriptImprovement = improveExisting;
    const title = isManuscriptImprovement
      ? `Manuscript improvement — ${body.sourceChapterTitle || 'draft'}`
      : draftTitle(mode, output);
    const outputType = isManuscriptImprovement ? 'manuscript-improvement' : 'novel-write-pro';
    const resultKind = isManuscriptImprovement ? 'manuscript-improvement' : 'novel-write-pro';

    const structured: NovelWriteProStructuredArtifacts = {
      projectBible: plan,
      premise: plan.premise,
      formatDecision: plan.formatDecision,
      characterWoundMap: plan.characterWoundMap,
      scenePlan: plan.scenePlan,
      firstDraft,
      criticReport,
      improvedRewrite,
    };

    const record = await outputRegistry.register({
      projectId: body.projectId,
      type: outputType,
      title,
      path: '',
      metadata: {
        kind: resultKind,
        text: improvedRewrite,
        firstDraft,
        criticReport,
        structured,
        provider,
        model,
        mode,
        output,
        spark: premise,
        tone,
        sourceChapterId: body.chapterId,
        sourceChapterTitle: body.sourceChapterTitle,
        improvementMode: isManuscriptImprovement ? 'polish' : mode,
        improveExisting: isManuscriptImprovement,
      },
    });

    if (body.projectId) {
      await projectBibleService.mergeFromNovelWritePro(body.projectId, {
        outputId: record.id,
        premise: plan.premise,
        genre: plan.genre || genre,
        tone: plan.tone || tone,
        intendedAudience: plan.intendedAudience,
        characters: plan.characters,
        setting: plan.setting,
        themes: plan.themes,
        structure: plan.structure,
        sourceNotes: plan.sourceNotes || sourceText.slice(0, 500),
        styleRules: plan.styleRules,
        formatDecision: plan.formatDecision,
        scenePlan: plan.scenePlan,
        characterWoundMap: plan.characterWoundMap,
      });
    }

    return {
      outputId: record.id,
      projectId: body.projectId,
      title,
      kind: resultKind,
      text: improvedRewrite,
      provider,
      model,
      createdAt: record.createdAt,
      structured,
      sourceChapterId: body.chapterId,
      sourceChapterTitle: body.sourceChapterTitle,
    };
  }
}

export const novelWriteProService = new NovelWriteProService();

// Legacy single-blob prompt kept for Open WebUI handoff elsewhere
export { buildNovelWriteProAutoWritePrompt };
