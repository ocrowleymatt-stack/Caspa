import { aiOrchestrator } from '../ai';
import { outputRegistry } from '../outputs';
import type { Chapter, PlotPoint, Project } from '../../shared';
import {
  hasStructuralPurpose,
  PIER_FILLER_REFUSAL,
  type PierExtendResult,
  type PierGap,
  type PierNextStep,
  type PierPoleSummary,
  type PierSurveyResult,
} from '../../shared/pierBuilder';
import { buildStructureTree } from './structureUnitMigration';
import { ChapterService } from './ChapterService';
import { PlotService } from './PlotService';
import { ProjectService } from './ProjectService';

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function poleComplete(pole: PlotPoint): boolean {
  return Boolean(pole.title.trim() && pole.description.trim().length >= 20);
}

function workingProseUnits(chapters: Chapter[]): Chapter[] {
  return chapters.filter(
    (chapter) =>
      chapter.sourceRole !== 'original'
      && chapter.unitStatus !== 'source'
      && (chapter.wordCount > 0 || chapter.content.trim().length > 0),
  );
}

function inferNextStep(
  project: Project,
  poles: PlotPoint[],
  gaps: PierGap[],
  warnings: string[],
): { step: PierNextStep; reason: string } {
  if (poles.length === 0) {
    return {
      step: 'place-pole',
      reason: 'No structural poles yet. Place beats before laying prose between them.',
    };
  }

  const incomplete = poles.filter((pole) => !poleComplete(pole));
  if (incomplete.length > 0) {
    return {
      step: 'place-pole',
      reason: `${incomplete.length} pole(s) need a clearer structural purpose before writing.`,
    };
  }

  const proseGaps = gaps.filter((gap) => !gap.hasProseCoverage);
  if (proseGaps.length > 0) {
    return {
      step: 'lay-boards',
      reason: `Prose is missing between "${proseGaps[0].fromTitle}" and "${proseGaps[0].toTitle}".`,
    };
  }

  if (warnings.some((warning) => warning.toLowerCase().includes('research'))) {
    return {
      step: 'research',
      reason: 'Survey flagged topics that may need research before further drafting.',
    };
  }

  const progress = project.targetWordCount
    ? Math.round((project.currentWordCount / project.targetWordCount) * 100)
    : 0;

  if (progress >= 95 && poles.length >= 3) {
    return {
      step: 'ready',
      reason: 'Structure spans are covered and the project is near its target length.',
    };
  }

  if (progress < 85 && poles.length >= 2) {
    return {
      step: 'stretch-decking',
      reason: 'Structure exists — expand only where a beat creates a documented need.',
    };
  }

  return {
    step: 'place-pole',
    reason: 'Add another structural pole before expanding prose.',
  };
}

function buildGaps(poles: PlotPoint[], chapters: Chapter[]): PierGap[] {
  if (poles.length < 2) return [];
  const proseUnits = workingProseUnits(chapters);
  const hasProse = proseUnits.length > 0;

  const gaps: PierGap[] = [];
  for (let index = 0; index < poles.length - 1; index += 1) {
    const from = poles[index];
    const to = poles[index + 1];
    gaps.push({
      fromPoleId: from.id,
      toPoleId: to.id,
      fromTitle: from.title,
      toTitle: to.title,
      hasProseCoverage: hasProse && index < proseUnits.length,
      estimatedNeed: hasProse ? 'prose' : 'structure',
    });
  }
  return gaps;
}

export class PierBuilderService {
  private readonly projectService = new ProjectService();
  private readonly plotService = new PlotService();
  private readonly chapterService = new ChapterService();

  async survey(projectId: string): Promise<PierSurveyResult> {
    const project = await this.projectService.getProject(projectId);
    const [poles, chapters] = await Promise.all([
      this.plotService.listPlotPoints(projectId),
      this.chapterService.listChapters(projectId),
    ]);
    const tree = buildStructureTree(chapters);
    const gaps = buildGaps(poles, chapters);
    const warnings: string[] = [];

    if (chapters.length === 0) {
      warnings.push('No manuscript units yet — survey is structure-first until text exists.');
    }
    if (poles.length === 0 && project.currentWordCount > 500) {
      warnings.push('Manuscript text exists without structural poles — risk of filler expansion.');
    }
    if (project.fictionality === 'nonfiction' && poles.length < 2) {
      warnings.push('Nonfiction may need research-backed argument poles before drafting.');
    }

    const { step, reason } = inferNextStep(project, poles, gaps, warnings);
    const progressPercent = project.targetWordCount
      ? Math.min(100, Math.round((project.currentWordCount / project.targetWordCount) * 100))
      : 0;

    return {
      projectId,
      workType: project.workType,
      structureType: project.structureType,
      workflowStage: project.workflowStage,
      wordCount: project.currentWordCount,
      targetWordCount: project.targetWordCount,
      progressPercent,
      poleCount: poles.length,
      structureUnitCount: tree.length,
      poles: poles.map((pole) => ({
        id: pole.id,
        title: pole.title,
        description: pole.description,
        order: pole.order,
        type: pole.type,
        chapterId: pole.chapterId,
        complete: poleComplete(pole),
      })),
      gaps,
      warnings,
      recommendedNextStep: step,
      recommendationReason: reason,
    };
  }

  async placePole(input: {
    projectId: string;
    poleId?: string;
    title: string;
    description: string;
    type?: PlotPoint['type'];
    order?: number;
    chapterId?: string;
  }): Promise<{ pole: PlotPoint; created: boolean }> {
    if (!input.title.trim()) {
      throw new Error('title is required');
    }
    if (!input.description.trim()) {
      throw new Error('description is required — poles must state structural purpose');
    }

    if (input.poleId) {
      const pole = await this.plotService.updatePlotPoint(input.poleId, {
        title: input.title.trim(),
        description: input.description.trim(),
        type: input.type,
        chapterId: input.chapterId,
      });
      await this.projectService.updateProject(input.projectId, { workflowStage: 'drafting' });
      return { pole, created: false };
    }

    const existing = await this.plotService.listPlotPoints(input.projectId);
    const pole = await this.plotService.createPlotPoint({
      projectId: input.projectId,
      title: input.title.trim(),
      description: input.description.trim(),
      type: input.type ?? 'other',
      order: input.order ?? existing.length,
      chapterId: input.chapterId,
    });
    await this.projectService.updateProject(input.projectId, { workflowStage: 'drafting' });
    return { pole, created: true };
  }

  async layBoards(input: {
    projectId: string;
    fromPoleId: string;
    toPoleId: string;
    tone?: string;
  }): Promise<
    | { refused: false; outputId: string; title: string; text: string; provider: string; model: string }
    | { refused: true; message: string; recommendation: PierNextStep }
  > {
    const poles = await this.plotService.listPlotPoints(input.projectId);
    const from = poles.find((pole) => pole.id === input.fromPoleId);
    const to = poles.find((pole) => pole.id === input.toPoleId);
    if (!from || !to) {
      throw new Error('Both fromPoleId and toPoleId must belong to this project');
    }
    if (from.order >= to.order) {
      throw new Error('fromPoleId must come before toPoleId in pole order');
    }
    if (!poleComplete(from) || !poleComplete(to)) {
      return {
        refused: true,
        message: PIER_FILLER_REFUSAL,
        recommendation: 'place-pole',
      };
    }

    const project = await this.projectService.getProject(input.projectId);
    const chapters = await this.chapterService.listChapters(input.projectId);
    const context = chapters
      .filter((chapter) => chapter.content.trim())
      .slice(0, 3)
      .map((chapter) => `## ${chapter.title}\n${chapter.content.slice(0, 1200)}`)
      .join('\n\n');

    const tone = input.tone ?? 'Clear, vivid, structurally motivated';
    const prompt = [
      'Write prose ONLY for the span between two structural beats.',
      'Do not repeat information already implied by the beats.',
      'Do not add description unless it changes character, pressure, setting, foreshadowing, conflict, pacing, or payoff.',
      'No filler. No padding. Every sentence must advance the span.',
      '',
      `Project: ${project.title}`,
      `Work type: ${project.workType ?? project.genre}`,
      `Tone: ${tone}`,
      '',
      `FROM POLE — ${from.title}: ${from.description}`,
      `TO POLE — ${to.title}: ${to.description}`,
      '',
      context ? `Existing manuscript context (do not repeat verbatim):\n${context}` : 'No existing prose context.',
      '',
      'Return only the new prose for this span.',
    ].join('\n');

    const response = await aiOrchestrator.generateWithContext(
      { prompt, context: '', temperature: 0.72, maxTokens: 2200 },
      input.projectId,
    );
    const text = response.text.trim();
    if (!text) {
      throw new Error('Lay boards produced empty prose — check AI provider.');
    }

    const title = `Pier boards — ${from.title} → ${to.title}`;
    const record = await outputRegistry.register({
      projectId: input.projectId,
      type: 'pier-boards',
      title,
      path: '',
      metadata: {
        kind: 'pier-boards',
        text,
        fromPoleId: from.id,
        toPoleId: to.id,
        fromPoleTitle: from.title,
        toPoleTitle: to.title,
        provider: response.model?.includes('mistral') ? 'ollama' : 'cloud',
        model: response.model,
        tone,
      },
    });

    await this.projectService.updateProject(input.projectId, { workflowStage: 'expanding' });

    return {
      refused: false,
      outputId: record.id,
      title,
      text,
      provider: String(record.metadata.provider ?? 'cloud'),
      model: String(record.metadata.model ?? 'unknown'),
    };
  }

  async stretchDecking(input: {
    projectId: string;
    sourceText: string;
    structuralPurpose: string;
    targetExtraWords?: number;
    unitId?: string;
  }): Promise<
    | { refused: false; outputId: string; title: string; text: string; addedWords: number }
    | { refused: true; message: string; recommendation: PierNextStep }
  > {
    if (!input.sourceText.trim()) {
      throw new Error('sourceText is required');
    }
    if (!hasStructuralPurpose(input.structuralPurpose)) {
      return {
        refused: true,
        message: PIER_FILLER_REFUSAL,
        recommendation: 'place-pole',
      };
    }

    const poles = await this.plotService.listPlotPoints(input.projectId);
    if (poles.length < 2) {
      return {
        refused: true,
        message: PIER_FILLER_REFUSAL,
        recommendation: 'place-pole',
      };
    }

    const targetExtraWords = Math.min(Math.max(input.targetExtraWords ?? 180, 80), 600);
    const prompt = [
      'Expand the excerpt ONLY where the stated structural purpose requires new material.',
      'Do not repeat existing information.',
      'Do not add description unless it changes character, pressure, setting, foreshadowing, conflict, pacing, or payoff.',
      'If the purpose cannot be served without filler, return exactly: REFUSE_FILLER',
      '',
      `Structural purpose: ${input.structuralPurpose.trim()}`,
      `Target extra words (approx): ${targetExtraWords}`,
      '',
      'Source excerpt:',
      input.sourceText.trim(),
      '',
      'Return the full revised excerpt with the expansion integrated.',
    ].join('\n');

    const response = await aiOrchestrator.generateWithContext(
      { prompt, context: '', temperature: 0.65, maxTokens: 2400 },
      input.projectId,
    );
    const text = response.text.trim();
    if (!text || text.includes('REFUSE_FILLER')) {
      return {
        refused: true,
        message: PIER_FILLER_REFUSAL,
        recommendation: 'place-pole',
      };
    }

    const addedWords = Math.max(0, countWords(text) - countWords(input.sourceText));
    const title = `Pier stretch — ${input.structuralPurpose.trim().slice(0, 48)}`;
    const record = await outputRegistry.register({
      projectId: input.projectId,
      type: 'pier-stretch',
      title,
      path: '',
      metadata: {
        kind: 'pier-stretch',
        text,
        sourceText: input.sourceText,
        structuralPurpose: input.structuralPurpose.trim(),
        unitId: input.unitId,
        addedWords,
        provider: response.model?.includes('mistral') ? 'ollama' : 'cloud',
        model: response.model,
      },
    });

    await this.projectService.updateProject(input.projectId, { workflowStage: 'expanding' });

    return {
      refused: false,
      outputId: record.id,
      title,
      text,
      addedWords,
    };
  }

  async extend(projectId: string): Promise<PierExtendResult> {
    const survey = await this.survey(projectId);
    return {
      projectId,
      recommendedNextStep: survey.recommendedNextStep,
      recommendationReason: survey.recommendationReason,
      survey,
    };
  }
}

export const pierBuilderService = new PierBuilderService();
