import { generateId } from '../../shared';
import { aiWithFallback, getProjectChapters, getProjectFullText } from '../../shared/elevationHelpers';
import {
  analyseManuscriptImport,
  type DetectedUnit,
  type ImportAnalysisResult,
} from '../manuscript/ImportAnalyser';
import { importService } from '../manuscript/ImportService';
import { ProjectService } from '../manuscript/ProjectService';
import { outputRegistry } from '../outputs';
import { projectSnapshotService } from './ProjectSnapshotService';
import type { ManuscriptStructureReport } from './types';

function buildSuggestedNextSteps(analysis: ImportAnalysisResult): string[] {
  const steps: string[] = [];
  if (analysis.confidence === 'low') {
    steps.push('Review detected work type — structure detection is uncertain.');
  }
  if (analysis.recommendedImportMode === 'split-into-units' && analysis.detectedUnits.length >= 2) {
    steps.push(`Review ${analysis.detectedUnits.length} detected units before splitting into chapters.`);
  }
  if (analysis.recommendedImportMode === 'whole-manuscript-source') {
    steps.push('Large manuscript kept as one source — run structure analysis again after editing headings.');
  }
  if (analysis.warnings.length > 0) {
    steps.push('Read import warnings before applying structure.');
  }
  steps.push('Generate Project Bible to capture premise, characters and style rules.');
  steps.push('Generate Book Map to see missing chapters and finish roadmap.');
  return steps;
}

export function toStructureReport(
  analysis: ImportAnalysisResult,
  opts?: { projectId?: string; sourceId?: string },
): ManuscriptStructureReport {
  return {
    projectId: opts?.projectId,
    sourceId: opts?.sourceId,
    detectedType: analysis.detectedWorkType,
    confidence: analysis.confidence,
    totalWords: analysis.totalWordCount,
    units: analysis.detectedUnits.map((unit, index) => ({
      id: generateId(),
      order: index + 1,
      type: unit.type,
      title: unit.title,
      startOffset: unit.startIndex,
      endOffset: unit.endIndex,
      wordCount: unit.wordCount,
      sourceRole: 'original' as const,
      needsReview: analysis.confidence === 'low' || analysis.warnings.length > 0,
    })),
    warnings: analysis.warnings,
    suggestedNextSteps: buildSuggestedNextSteps(analysis),
    recommendedImportMode: analysis.recommendedImportMode,
    structureType: analysis.structureType,
  };
}

export class ManuscriptStructureService {
  private readonly projectService = new ProjectService();

  analyse(input: {
    rawText: string;
    filename?: string;
    declaredWorkType?: import('../../shared/workModel').WorkType;
    projectId?: string;
    saveOutput?: boolean;
  }): ManuscriptStructureReport {
    const analysis = analyseManuscriptImport({
      rawText: input.rawText,
      filename: input.filename,
      declaredWorkType: input.declaredWorkType,
    });
    return toStructureReport(analysis, { projectId: input.projectId });
  }

  async analyseAndSave(input: {
    rawText: string;
    filename?: string;
    declaredWorkType?: import('../../shared/workModel').WorkType;
    projectId: string;
    user?: import('../auth/types').UserPublic;
  }): Promise<{ report: ManuscriptStructureReport; outputId: string }> {
    await this.projectService.getProject(input.projectId, input.user);
    const report = this.analyse(input);
    report.projectId = input.projectId;

    const record = await outputRegistry.register({
      projectId: input.projectId,
      type: 'imported-source-analysis',
      title: `Manuscript structure report — ${input.filename ?? 'paste'}`,
      path: '',
      metadata: {
        kind: 'manuscript-structure-report',
        ...report,
      },
    });

    return { report, outputId: record.id };
  }

  async analyseProjectManuscript(
    projectId: string,
    user?: import('../auth/types').UserPublic,
  ): Promise<{ report: ManuscriptStructureReport; outputId: string }> {
    const project = await this.projectService.getProject(projectId, user);
    const chapters = await getProjectChapters(projectId);
    const sourceChapter = chapters.find((c) => c.sourceRole === 'original')
      ?? chapters.find((c) => c.unitStatus === 'source')
      ?? chapters[0];
    const rawText = sourceChapter?.content?.trim()
      || (await getProjectFullText(projectId, 200_000));

    return this.analyseAndSave({
      rawText,
      filename: sourceChapter?.title ?? project.title,
      declaredWorkType: project.workType,
      projectId,
      user,
    });
  }

  async applyStructure(
    projectId: string,
    body: {
      importMode?: 'split-into-units' | 'whole-manuscript-source' | 'single-unit';
      rawText?: string;
      filename?: string;
      detectedUnits?: DetectedUnit[];
    },
    user?: import('../auth/types').UserPublic,
  ): Promise<{
    snapshotId: string;
    chaptersCreated: number;
    unitTitles: string[];
    importMode: string;
  }> {
    const project = await this.projectService.getProject(projectId, user);
    const chapters = await getProjectChapters(projectId);
    const sourceChapter = chapters.find((c) => c.sourceRole === 'original')
      ?? chapters.find((c) => c.unitStatus === 'source')
      ?? chapters[0];
    const rawText = body.rawText?.trim()
      || sourceChapter?.content?.trim()
      || (await getProjectFullText(projectId, 200_000));
    if (!rawText) {
      throw new Error('No manuscript text found — add source material or paste text first.');
    }

    const analysis = analyseManuscriptImport({
      rawText,
      filename: body.filename ?? sourceChapter?.title ?? project.title,
      declaredWorkType: project.workType,
    });

    const importMode = body.importMode
      ?? analysis.recommendedImportMode
      ?? (analysis.detectedUnits.length >= 2 ? 'split-into-units' : 'whole-manuscript-source');

    const snapshot = await projectSnapshotService.create(
      projectId,
      { label: 'Before structure apply', reason: 'structure-apply' },
      user,
    );

    const detectedUnits = body.detectedUnits
      ?? analysis.detectedUnits.map((unit) => ({
        type: unit.type,
        title: unit.title,
        startIndex: unit.startIndex,
        endIndex: unit.endIndex,
        wordCount: unit.wordCount,
      }));

    const result = await importService.apply(
      {
        projectId,
        rawText,
        filename: body.filename ?? sourceChapter?.title ?? project.title,
        importMode: importMode as 'split-into-units' | 'whole-manuscript-source' | 'single-unit',
        detectedUnits,
        workType: project.workType,
      },
      user!,
    );

    return {
      snapshotId: snapshot.id,
      chaptersCreated: result.chaptersCreated,
      unitTitles: result.unitTitles,
      importMode: result.importMode,
    };
  }
}

export const manuscriptStructureService = new ManuscriptStructureService();
