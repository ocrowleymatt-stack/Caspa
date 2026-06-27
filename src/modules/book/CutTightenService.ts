import { aiWithFallback } from '../../shared/elevationHelpers';
import { outputRegistry } from '../outputs';
import { projectSnapshotService } from './ProjectSnapshotService';
import { ChapterService } from '../manuscript/ChapterService';
import { ProjectService } from '../manuscript/ProjectService';
import { buildCreativeSpecPrompt } from '../../shared/creativeSpecPrompt';
import { productionBriefService } from '../studio/ProductionBriefService';

export interface CutAnalyseRequest {
  projectId: string;
  unitId?: string;
  targetRuntimeMinutes?: number;
  targetPageCount?: number;
  targetWordCount?: number;
  cutDepth?: 'light' | 'moderate' | 'ruthless';
  preserveTone?: boolean;
  preservePlot?: boolean;
  preserveJokes?: boolean;
  preserveSongs?: boolean;
  notes?: string;
}

export class CutTightenService {
  private readonly projectService = new ProjectService();
  private readonly chapterService = new ChapterService();

  async analyse(input: CutAnalyseRequest, user?: import('../auth/types').UserPublic) {
    await this.projectService.getProject(input.projectId, user);
    const brief = await productionBriefService.get(input.projectId, user);
    const chapters = await this.chapterService.listChapters(input.projectId);
    const unit = input.unitId
      ? chapters.find((c) => c.id === input.unitId)
      : null;
    const sourceText = unit?.content?.trim()
      ?? chapters.map((c) => `# ${c.title}\n\n${c.content ?? ''}`).join('\n\n');
    const currentWordCount = sourceText.split(/\s+/).filter(Boolean).length;
    const targetWordCount = input.targetWordCount
      ?? (input.targetPageCount ? input.targetPageCount * 250 : undefined)
      ?? (input.targetRuntimeMinutes ? input.targetRuntimeMinutes * 150 : undefined)
      ?? Math.round(currentWordCount * 0.9);

    const { text } = await aiWithFallback(
      [
        'Produce a CUT MAP JSON for tightening this script/manuscript WITHOUT changing the story.',
        'Return JSON only:',
        '{ "cutNeeded": number, "estimatedRuntime": number, "targetRuntime": number, "cutCandidates": [{ "title", "cutType", "reason", "risk", "estimatedWordsSaved" }], "keepList": [], "risks": [], "cutReport": "..." }',
        `Cut depth: ${input.cutDepth ?? 'moderate'}`,
        buildCreativeSpecPrompt(brief),
      ].join('\n'),
      sourceText.slice(0, 30000),
      JSON.stringify({ cutNeeded: 0, cutCandidates: [], keepList: [], risks: [], cutReport: 'Unable to analyse' }),
      input.projectId,
    );

    let parsed: Record<string, unknown> = {};
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      parsed = { cutReport: text };
    }

    const record = await outputRegistry.register({
      projectId: input.projectId,
      type: 'other',
      title: unit ? `Cut map — ${unit.title}` : 'Cut map — full work',
      path: '',
      metadata: {
        kind: 'cut-map',
        text: String(parsed.cutReport ?? text),
        cutMap: parsed,
        unitId: input.unitId,
        currentWordCount,
        targetWordCount,
        destination: input.unitId ? 'beside-unit' : 'writing-history',
      },
    });

    return {
      success: true,
      outputId: record.id,
      currentWordCount,
      targetWordCount,
      cutNeeded: Number(parsed.cutNeeded ?? Math.max(0, currentWordCount - targetWordCount)),
      cutMap: parsed,
      cutReport: String(parsed.cutReport ?? text),
      unitId: input.unitId,
    };
  }

  async generateDraft(
    input: CutAnalyseRequest & { cutReport?: string; cutMap?: Record<string, unknown> },
    user?: import('../auth/types').UserPublic,
  ) {
    await this.projectService.getProject(input.projectId, user);
    const brief = await productionBriefService.get(input.projectId, user);
    const chapters = await this.chapterService.listChapters(input.projectId);
    const unit = input.unitId ? chapters.find((c) => c.id === input.unitId) : null;
    const sourceText = unit?.content?.trim()
      ?? chapters.map((c) => `# ${c.title}\n\n${c.content ?? ''}`).join('\n\n');
    const targetWordCount = input.targetWordCount
      ?? Math.round(sourceText.split(/\s+/).filter(Boolean).length * 0.9);

    const { text: draftText } = await aiWithFallback(
      [
        'Tighten this manuscript following the cut map. Preserve story, characters, chronology, and voice.',
        'Return the full tightened text only — no commentary.',
        `Target length ~${targetWordCount} words. Cut depth: ${input.cutDepth ?? 'moderate'}.`,
        buildCreativeSpecPrompt(brief),
        input.cutReport ? `Cut report:\n${input.cutReport}` : '',
      ].filter(Boolean).join('\n'),
      sourceText.slice(0, 35000),
      sourceText.slice(0, Math.min(sourceText.length, targetWordCount * 6)),
      input.projectId,
    );

    const wordCount = draftText.split(/\s+/).filter(Boolean).length;
    const record = await outputRegistry.register({
      projectId: input.projectId,
      type: 'other',
      title: unit ? `Cut draft — ${unit.title}` : 'Cut draft — full work',
      path: '',
      metadata: {
        kind: 'cut-draft',
        text: draftText,
        cutMap: input.cutMap,
        unitId: input.unitId,
        cutDepth: input.cutDepth,
        destination: input.unitId ? 'beside-unit' : 'writing-history',
        applyMode: 'review-before-apply',
      },
    });

    return {
      outputId: record.id,
      draftText,
      wordCount,
      targetWordCount,
      unitId: input.unitId,
    };
  }

  async apply(
    projectId: string,
    body: { unitId?: string; revisedText: string; outputId?: string },
    user?: import('../auth/types').UserPublic,
  ) {
    await this.projectService.getProject(projectId, user);
    await projectSnapshotService.create(projectId, { label: 'Before cut apply', reason: 'cut-apply' }, user);

    if (body.unitId) {
      const chapter = await this.chapterService.getChapter(body.unitId);
      if (chapter.projectId !== projectId) {
        throw new Error('Unit does not belong to this project.');
      }
      const updated = await this.chapterService.updateChapter(body.unitId, {
        content: body.revisedText,
        wordCount: body.revisedText.split(/\s+/).filter(Boolean).length,
      });
      return { applied: true, unitId: updated.id };
    }

    throw new Error('unitId required to apply cut text');
  }
}

export const cutTightenService = new CutTightenService();
