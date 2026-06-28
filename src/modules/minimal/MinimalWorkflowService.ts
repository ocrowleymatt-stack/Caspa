import { getProjectFullText } from '../../shared/elevationHelpers';
import { readJsonFile, writeJsonFile } from '../../shared/fileStore';
import { bookMapService } from '../book/BookMapService';
import { manuscriptApplyOutputService } from '../book/ManuscriptApplyOutputService';
import { manuscriptAssembleService } from '../book/ManuscriptAssembleService';
import { manuscriptStructureService } from '../book/ManuscriptStructureService';
import { projectExportService } from '../book/ProjectExportService';
import { novelWriteProService } from '../casper-freestyle/NovelWriteProService';
import { goldPassRunService } from '../gold/GoldPassRunService';
import { goldSourceLockService } from '../gold/GoldSourceLockService';
import { ChapterService } from '../manuscript/ChapterService';
import { projectBibleService } from '../manuscript/ProjectBibleService';
import { ProjectService } from '../manuscript/ProjectService';
import { projectAssetService } from '../studio/ProjectAssetService';
import { importService } from '../manuscript/ImportService';
import { caspaJobService } from '../jobs/CaspaJobService';

const STATE_PATH = 'minimal-workflow';
const MIN_MATERIAL_CHARS = 80;
const MIN_EXPORT_WORDS = 50;
const MIN_IMPROVE_WORDS = 120;

export type MinimalPhase = 'empty' | 'material' | 'built' | 'drafted' | 'improved' | 'exported';
export type MinimalStepId = 'drop' | 'build' | 'write' | 'improve' | 'export';

export interface MinimalStep {
  id: MinimalStepId;
  label: string;
  status: 'done' | 'current' | 'ready' | 'locked';
  detail: string;
}

export interface MinimalCapabilities {
  canBuild: boolean;
  canWrite: boolean;
  canImprove: boolean;
  canExport: boolean;
  buildReason?: string;
  writeReason?: string;
  improveReason?: string;
  exportReason?: string;
}

export interface MinimalWorkflowState {
  projectId: string;
  projectTitle: string;
  phase: MinimalPhase;
  writeProgress: number;
  materialCount: number;
  materialChars: number;
  chapterCount: number;
  wordCount: number;
  targetWordCount: number;
  preview: string;
  statusMessage: string;
  nextAction: MinimalStepId;
  steps: MinimalStep[];
  capabilities: MinimalCapabilities;
  lastAction?: string;
  updatedAt: string;
}

interface StoredMinimalFlags {
  builtAt?: string;
  draftedAt?: string;
  improvedAt?: string;
  exportedAt?: string;
  writeProgress?: number;
}

function stateFile(projectId: string): string {
  return `${projectId}.json`;
}

export class MinimalWorkflowService {
  private readonly projectService = new ProjectService();
  private readonly chapterService = new ChapterService();

  private async readFlags(projectId: string): Promise<StoredMinimalFlags> {
    return (await readJsonFile<StoredMinimalFlags>(STATE_PATH, stateFile(projectId))) ?? {};
  }

  private async writeFlags(projectId: string, patch: StoredMinimalFlags): Promise<void> {
    const current = await this.readFlags(projectId);
    await writeJsonFile(STATE_PATH, stateFile(projectId), { ...current, ...patch });
  }

  async getState(projectId: string, user?: import('../auth/types').UserPublic): Promise<MinimalWorkflowState> {
    const project = await this.projectService.getProject(projectId, user);
    const [assets, chapters, flags, assembled] = await Promise.all([
      projectAssetService.list(projectId, user),
      this.chapterService.listChapters(projectId),
      this.readFlags(projectId),
      manuscriptAssembleService.assemble(projectId, user).catch(() => null),
    ]);

    const materialChars = assets.reduce((sum, asset) => sum + asset.sourceText.trim().length, 0);
    const wordCount = assembled?.currentWordCount
      ?? chapters.reduce((sum, chapter) => sum + (chapter.wordCount ?? 0), 0);
    const preview = assembled?.fullText?.slice(0, 4000)
      ?? chapters.map((c) => c.content ?? '').join('\n\n').slice(0, 4000);

    let phase: MinimalPhase = 'empty';
    if (assets.length > 0 || wordCount > 0) phase = 'material';
    if (flags.builtAt) phase = 'built';
    if (flags.draftedAt) phase = 'drafted';
    if (flags.improvedAt) phase = 'improved';
    if (flags.exportedAt) phase = 'exported';

    const capabilities = this.computeCapabilities({
      materialCount: assets.length,
      materialChars,
      wordCount,
      chapterCount: chapters.length,
      builtAt: flags.builtAt,
      draftedAt: flags.draftedAt,
    });
    const nextAction = this.computeNextAction({ phase, capabilities, flags });
    const steps = this.computeSteps({ phase, capabilities, nextAction, flags });

    return {
      projectId,
      projectTitle: project.title,
      phase,
      writeProgress: flags.writeProgress ?? (flags.draftedAt ? 100 : flags.builtAt ? 30 : 0),
      materialCount: assets.length,
      materialChars,
      chapterCount: chapters.length,
      wordCount,
      targetWordCount: project.targetWordCount ?? 0,
      preview,
      statusMessage: this.statusForPhase(nextAction, capabilities, materialChars, wordCount),
      nextAction,
      steps,
      capabilities,
      lastAction: flags.exportedAt ?? flags.improvedAt ?? flags.draftedAt ?? flags.builtAt,
      updatedAt: new Date().toISOString(),
    };
  }

  private computeCapabilities(input: {
    materialCount: number;
    materialChars: number;
    wordCount: number;
    chapterCount: number;
    builtAt?: string;
    draftedAt?: string;
  }): MinimalCapabilities {
    const hasMaterial = input.materialCount > 0 && input.materialChars >= MIN_MATERIAL_CHARS;
    const hasManuscriptSeed = input.wordCount >= 20;
    const canBuild = hasMaterial || hasManuscriptSeed;
    const canWrite = Boolean(input.builtAt) && input.chapterCount > 0;
    const canImprove = Boolean(input.builtAt) && input.wordCount >= MIN_IMPROVE_WORDS;
    const canExport = input.wordCount >= MIN_EXPORT_WORDS;

    return {
      canBuild,
      canWrite,
      canImprove,
      canExport,
      buildReason: canBuild
        ? undefined
        : `Add notes or a draft first (at least ${MIN_MATERIAL_CHARS} characters).`,
      writeReason: canWrite
        ? undefined
        : !input.builtAt
          ? 'Run Auto Build to create chapters from your material.'
          : 'Auto Build did not create any sections — add more material and build again.',
      improveReason: canImprove
        ? undefined
        : !input.builtAt
          ? 'Run Auto Build before polishing.'
          : `Write at least ${MIN_IMPROVE_WORDS} words before Improve.`,
      exportReason: canExport
        ? undefined
        : `Need at least ${MIN_EXPORT_WORDS} words in your manuscript.`,
    };
  }

  private computeNextAction(input: {
    phase: MinimalPhase;
    capabilities: MinimalCapabilities;
    flags: StoredMinimalFlags;
  }): MinimalStepId {
    const { capabilities, flags } = input;
    if (!capabilities.canBuild && input.phase === 'empty') return 'drop';
    if (!flags.builtAt) return capabilities.canBuild ? 'build' : 'drop';
    if (!flags.draftedAt || input.phase === 'built') return 'write';
    if (!flags.improvedAt && capabilities.canImprove) return 'improve';
    if (capabilities.canExport) return 'export';
    if (capabilities.canWrite) return 'write';
    return 'drop';
  }

  private computeSteps(input: {
    phase: MinimalPhase;
    capabilities: MinimalCapabilities;
    nextAction: MinimalStepId;
    flags: StoredMinimalFlags;
  }): MinimalStep[] {
    const { capabilities, nextAction, flags } = input;
    const stepMeta: Array<{ id: MinimalStepId; label: string; detail: string }> = [
      { id: 'drop', label: 'Drop material', detail: 'Notes, drafts, fragments — originals stay safe.' },
      { id: 'build', label: 'Auto Build', detail: 'Turn sources into structure, bible, and book map.' },
      { id: 'write', label: 'Auto Write', detail: 'Draft the next section of your manuscript.' },
      { id: 'improve', label: 'Improve', detail: 'Polish what you have without changing the story.' },
      { id: 'export', label: 'Export', detail: 'Download a shareable manuscript file.' },
    ];

    return stepMeta.map((step) => {
      let status: MinimalStep['status'] = 'locked';
      if (step.id === 'drop') {
        status = flags.builtAt ? 'done' : nextAction === 'drop' ? 'current' : 'ready';
      } else if (step.id === 'build') {
        if (nextAction === 'build') status = 'current';
        else if (flags.builtAt) status = 'done';
        else status = capabilities.canBuild ? 'ready' : 'locked';
      } else if (step.id === 'write') {
        if (nextAction === 'write') status = 'current';
        else if (capabilities.canWrite) status = flags.draftedAt ? 'ready' : 'ready';
        else status = 'locked';
      } else if (step.id === 'improve') {
        if (nextAction === 'improve') status = 'current';
        else if (flags.improvedAt) status = 'done';
        else status = capabilities.canImprove ? 'ready' : 'locked';
      } else if (step.id === 'export') {
        if (nextAction === 'export') status = 'current';
        else if (flags.exportedAt) status = 'done';
        else status = capabilities.canExport ? 'ready' : 'locked';
      }
      return { ...step, status };
    });
  }

  private async touchStage(
    jobId: string | undefined,
    stageId: string,
    fn: () => Promise<unknown>,
  ): Promise<unknown> {
    if (jobId) await caspaJobService.startStage(jobId, stageId);
    const result = await fn();
    if (jobId) await caspaJobService.completeStage(jobId, stageId, result);
    return result;
  }

  private async skipStage(jobId: string | undefined, stageId: string, partial?: unknown) {
    if (!jobId) return;
    await caspaJobService.startStage(jobId, stageId);
    await caspaJobService.completeStage(jobId, stageId, partial ?? { skipped: true });
  }

  private statusForPhase(
    nextAction: MinimalStepId,
    capabilities: MinimalCapabilities,
    materialChars: number,
    wordCount: number,
  ): string {
    if (nextAction === 'export') {
      return wordCount >= MIN_EXPORT_WORDS
        ? 'Manuscript ready — export when you are.'
        : capabilities.exportReason ?? 'Keep writing, then export.';
    }
    if (nextAction === 'improve') return 'Draft in place — Improve will polish without changing the story.';
    if (nextAction === 'write') return 'Structure ready — Auto Write drafts the next section.';
    if (nextAction === 'build') {
      return materialChars >= MIN_MATERIAL_CHARS
        ? 'Material loaded — Auto Build prepares your manuscript structure.'
        : capabilities.buildReason ?? 'Add a little more material, then Auto Build.';
    }
    return 'Drop notes, drafts, or files to begin.';
  }

  async autoBuild(
    projectId: string,
    user?: import('../auth/types').UserPublic,
    caspaJobId?: string,
  ) {
    await this.projectService.getProject(projectId, user);
    const assets = await projectAssetService.list(projectId, user);
    const combined = assets.map((asset) => asset.sourceText.trim()).filter(Boolean).join('\n\n---\n\n');

    let chapters = await this.chapterService.listChapters(projectId);
    const chapterWords = chapters.reduce((sum, chapter) => sum + (chapter.wordCount ?? 0), 0);

    if (!combined && chapterWords < 20) {
      throw new Error('Drop material first — nothing to build from.');
    }

    if (combined.length > 0 && combined.length < MIN_MATERIAL_CHARS && chapterWords < 20) {
      throw new Error(`Add a little more material before Auto Build (at least ${MIN_MATERIAL_CHARS} characters).`);
    }

    const rawText = combined || (await getProjectFullText(projectId, 200_000));
    if (!rawText.trim()) {
      throw new Error('No readable text found in your material.');
    }

    if (chapterWords < 20 && combined) {
      await this.touchStage(caspaJobId, 'import', () =>
        importService.apply({
          projectId,
          rawText: combined,
          filename: assets[0]?.originalFilename ?? assets[0]?.title ?? 'sources',
          importMode: 'whole-manuscript-source',
        }, user as import('../auth/types').UserPublic));
      chapters = await this.chapterService.listChapters(projectId);
    } else {
      await this.skipStage(caspaJobId, 'import');
    }

    const applied = await this.touchStage(caspaJobId, 'structure', async () => {
      await manuscriptStructureService.analyseAndSave({
        rawText,
        filename: assets[0]?.title ?? 'manuscript',
        projectId,
        user,
      });
      return manuscriptStructureService.applyStructure(projectId, { rawText }, user);
    });

    await this.touchStage(caspaJobId, 'bible', () => projectBibleService.generate(projectId));
    await this.touchStage(caspaJobId, 'book-map', () => bookMapService.generate(projectId, user));

    await this.touchStage(caspaJobId, 'finalize', async () => {
      await this.projectService.updateProject(projectId, { workflowStage: 'analysing' });
      await this.writeFlags(projectId, { builtAt: new Date().toISOString(), writeProgress: 30 });
      return { ready: true };
    });

    return {
      applied,
      message: 'Auto Build complete — story bible, structure, and book map are ready.',
      state: await this.getState(projectId, user),
    };
  }

  async autoWrite(
    projectId: string,
    user?: import('../auth/types').UserPublic,
    caspaJobId?: string,
  ) {
    await this.projectService.getProject(projectId, user);
    const flags = await this.readFlags(projectId);
    if (!flags.builtAt) {
      throw new Error('Run Auto Build first.');
    }

    const chapters = await this.chapterService.listChapters(projectId);
    if (chapters.length === 0) {
      throw new Error('No manuscript sections yet — run Auto Build after adding more material.');
    }

    const sorted = [...chapters].sort((a, b) => a.order - b.order);
    const target = sorted.find((chapter) => (chapter.wordCount ?? 0) < 800) ?? sorted[0];
    const sourceText = target.content?.trim() || (await getProjectFullText(projectId, 12_000));

    await this.touchStage(caspaJobId, 'prepare', async () => {
      await this.writeFlags(projectId, { writeProgress: 30 });
      return { chapterId: target.id, title: target.title };
    });

    const result = await this.touchStage(caspaJobId, 'draft', () =>
      novelWriteProService.generate({
        projectId,
        chapterId: target.id,
        sourceChapterTitle: target.title,
        improveExisting: Boolean(target.content?.trim()),
        mode: 'novel',
        source: sourceText,
      }));

    await this.writeFlags(projectId, { writeProgress: 70 });

    const applyMode = target.content?.trim() ? 'append-unit' : 'replace-unit';
    const applied = await this.touchStage(caspaJobId, 'apply', () =>
      manuscriptApplyOutputService.apply({
        projectId,
        outputId: (result as { outputId: string }).outputId,
        mode: applyMode,
        unitId: target.id,
        confirmed: true,
      }, user));

    await this.writeFlags(projectId, {
      draftedAt: new Date().toISOString(),
      writeProgress: 100,
    });

    return {
      outputId: (result as { outputId: string }).outputId,
      applied,
      message: `Auto Write complete — "${target.title}" updated in your manuscript.`,
      state: await this.getState(projectId, user),
    };
  }

  async improve(
    projectId: string,
    user?: import('../auth/types').UserPublic,
    caspaJobId?: string,
  ) {
    await this.projectService.getProject(projectId, user);
    const flags = await this.readFlags(projectId);
    if (!flags.builtAt) {
      throw new Error('Run Auto Build before Improve.');
    }

    const chapters = await this.chapterService.listChapters(projectId);
    const wordCount = chapters.reduce((sum, chapter) => sum + (chapter.wordCount ?? 0), 0);
    if (wordCount < MIN_IMPROVE_WORDS) {
      throw new Error(`Write at least ${MIN_IMPROVE_WORDS} words before Improve — run Auto Write first.`);
    }

    const lock = await this.touchStage(caspaJobId, 'lock', () =>
      goldSourceLockService.createLock({
        projectId,
        sourceType: 'current-manuscript',
        mode: 'improve-same-story',
        user,
      })) as Awaited<ReturnType<typeof goldSourceLockService.createLock>>;

    const result = await this.touchStage(caspaJobId, 'improve', () =>
      goldPassRunService.execute({
        projectId,
        sourceText: lock.sourceText,
        sourceLock: lock,
        improveText: true,
        stage: 'revision',
        user,
      })) as Awaited<ReturnType<typeof goldPassRunService.execute>>;

    let applied = null as Awaited<ReturnType<typeof manuscriptApplyOutputService.apply>> | null;
    if (!result.driftBlocked && result.outputId) {
      const improveChapters = await this.chapterService.listChapters(projectId);
      const primary = [...improveChapters].sort((a, b) => (b.wordCount ?? 0) - (a.wordCount ?? 0))[0];
      if (primary) {
        applied = await this.touchStage(caspaJobId, 'apply', () =>
          manuscriptApplyOutputService.apply({
            projectId,
            outputId: result.outputId,
            mode: 'replace-unit',
            unitId: primary.id,
            confirmed: true,
          }, user)) as Awaited<ReturnType<typeof manuscriptApplyOutputService.apply>>;
      } else {
        await this.skipStage(caspaJobId, 'apply', { skipped: true });
      }
    } else {
      await this.skipStage(caspaJobId, 'apply', { driftBlocked: result.driftBlocked });
    }

    await this.writeFlags(projectId, { improvedAt: new Date().toISOString() });

    return {
      outputId: result.outputId,
      driftBlocked: result.driftBlocked,
      applied,
      message: result.driftBlocked
        ? 'Improvement saved as an alternative — source drift detected, nothing overwritten.'
        : 'Improve complete — manuscript updated safely.',
      state: await this.getState(projectId, user),
    };
  }

  async exportAll(projectId: string, user?: import('../auth/types').UserPublic) {
    await this.projectService.getProject(projectId, user);
    const chapters = await this.chapterService.listChapters(projectId);
    const wordCount = chapters.reduce((sum, chapter) => sum + (chapter.wordCount ?? 0), 0);
    if (wordCount < MIN_EXPORT_WORDS) {
      throw new Error(`Need at least ${MIN_EXPORT_WORDS} words before Export — keep writing first.`);
    }

    const markdown = await projectExportService.exportMarkdownManuscript(projectId, user);
    const docx = await projectExportService.exportDocxManuscript(projectId, user);

    await this.writeFlags(projectId, { exportedAt: new Date().toISOString() });

    return {
      markdown,
      docxFilename: docx.filename,
      docxOutputId: docx.outputId,
      downloadUrl: `/api/projects/${projectId}/export/docx/download`,
      message: 'Export ready.',
      state: await this.getState(projectId, user),
    };
  }
}

export const minimalWorkflowService = new MinimalWorkflowService();
