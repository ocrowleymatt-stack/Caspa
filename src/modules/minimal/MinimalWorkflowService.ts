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

const STATE_PATH = 'minimal-workflow';

export type MinimalPhase = 'empty' | 'material' | 'built' | 'drafted' | 'improved' | 'exported';

export interface MinimalWorkflowState {
  projectId: string;
  phase: MinimalPhase;
  writeProgress: number;
  materialCount: number;
  wordCount: number;
  targetWordCount: number;
  preview: string;
  statusMessage: string;
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

    return {
      projectId,
      phase,
      writeProgress: flags.writeProgress ?? (flags.draftedAt ? 100 : flags.builtAt ? 30 : 0),
      materialCount: assets.length,
      wordCount,
      targetWordCount: project.targetWordCount ?? 0,
      preview,
      statusMessage: this.statusForPhase(phase, assets.length, wordCount),
      lastAction: flags.exportedAt ?? flags.improvedAt ?? flags.draftedAt ?? flags.builtAt,
      updatedAt: new Date().toISOString(),
    };
  }

  private statusForPhase(phase: MinimalPhase, materialCount: number, wordCount: number): string {
    if (phase === 'exported') return 'Ready to share — export complete.';
    if (phase === 'improved') return 'Draft polished — export when ready.';
    if (phase === 'drafted') return 'Draft written — press Improve or Export.';
    if (phase === 'built') return 'Structure ready — press Auto Write.';
    if (materialCount > 0) return `${materialCount} source item(s) loaded — press Auto Build.`;
    if (wordCount > 0) return 'Material in manuscript — add more or Auto Build.';
    return 'Drop anything here to begin.';
  }

  async autoBuild(projectId: string, user?: import('../auth/types').UserPublic) {
    await this.projectService.getProject(projectId, user);
    const assets = await projectAssetService.list(projectId, user);
    const combined = assets.map((asset) => asset.sourceText.trim()).filter(Boolean).join('\n\n---\n\n');

    let chapters = await this.chapterService.listChapters(projectId);
    const chapterWords = chapters.reduce((sum, chapter) => sum + (chapter.wordCount ?? 0), 0);

    if (!combined && chapterWords < 20) {
      throw new Error('Drop material first — nothing to build from.');
    }

    const rawText = combined || (await getProjectFullText(projectId, 200_000));
    if (!rawText.trim()) {
      throw new Error('No readable text found in your material.');
    }

    if (chapterWords < 20 && combined) {
      await importService.apply({
        projectId,
        rawText: combined,
        filename: assets[0]?.originalFilename ?? assets[0]?.title ?? 'sources',
        importMode: 'whole-manuscript-source',
      }, user as import('../auth/types').UserPublic);
      chapters = await this.chapterService.listChapters(projectId);
    }

    await manuscriptStructureService.analyseAndSave({
      rawText,
      filename: assets[0]?.title ?? 'manuscript',
      projectId,
      user,
    });

    const applied = await manuscriptStructureService.applyStructure(projectId, { rawText }, user);

    await projectBibleService.generate(projectId);
    await bookMapService.generate(projectId, user);

    await this.projectService.updateProject(projectId, { workflowStage: 'analysing' });
    await this.writeFlags(projectId, { builtAt: new Date().toISOString(), writeProgress: 30 });

    return {
      applied,
      message: 'Auto Build complete — story bible, structure, and book map are ready.',
      state: await this.getState(projectId, user),
    };
  }

  async autoWrite(projectId: string, user?: import('../auth/types').UserPublic) {
    await this.projectService.getProject(projectId, user);
    const flags = await this.readFlags(projectId);
    if (!flags.builtAt) {
      throw new Error('Run Auto Build first.');
    }

    const chapters = await this.chapterService.listChapters(projectId);
    if (chapters.length === 0) {
      throw new Error('No manuscript sections yet — run Auto Build.');
    }

    const sorted = [...chapters].sort((a, b) => a.order - b.order);
    const target = sorted.find((chapter) => (chapter.wordCount ?? 0) < 800) ?? sorted[0];
    const sourceText = target.content?.trim() || (await getProjectFullText(projectId, 12_000));

    await this.writeFlags(projectId, { writeProgress: 30 });

    const result = await novelWriteProService.generate({
      projectId,
      chapterId: target.id,
      sourceChapterTitle: target.title,
      improveExisting: Boolean(target.content?.trim()),
      mode: 'novel',
      source: sourceText,
    });

    await this.writeFlags(projectId, { writeProgress: 70 });

    const applyMode = target.content?.trim() ? 'append-unit' : 'replace-unit';
    const applied = await manuscriptApplyOutputService.apply({
      projectId,
      outputId: result.outputId,
      mode: applyMode,
      unitId: target.id,
      confirmed: true,
    }, user);

    await this.writeFlags(projectId, {
      draftedAt: new Date().toISOString(),
      writeProgress: 100,
    });

    return {
      outputId: result.outputId,
      applied,
      message: 'Auto Write complete — draft added to your manuscript.',
      state: await this.getState(projectId, user),
    };
  }

  async improve(projectId: string, user?: import('../auth/types').UserPublic) {
    await this.projectService.getProject(projectId, user);
    const flags = await this.readFlags(projectId);
    if (!flags.draftedAt && !flags.builtAt) {
      throw new Error('Write something first — run Auto Write or add material.');
    }

    const lock = await goldSourceLockService.createLock({
      projectId,
      sourceType: 'current-manuscript',
      mode: 'improve-same-story',
      user,
    });

    const result = await goldPassRunService.execute({
      projectId,
      sourceText: lock.sourceText,
      sourceLock: lock,
      improveText: true,
      stage: 'revision',
      user,
    });

    let applied = null as Awaited<ReturnType<typeof manuscriptApplyOutputService.apply>> | null;
    if (!result.driftBlocked && result.outputId) {
      const chapters = await this.chapterService.listChapters(projectId);
      const primary = [...chapters].sort((a, b) => (b.wordCount ?? 0) - (a.wordCount ?? 0))[0];
      if (primary) {
        applied = await manuscriptApplyOutputService.apply({
          projectId,
          outputId: result.outputId,
          mode: 'replace-unit',
          unitId: primary.id,
          confirmed: true,
        }, user);
      }
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
