import type { UserPublic } from '../auth/types';
import { ChapterService } from './ChapterService';
import { NotFoundError, ProjectService } from './ProjectService';
import { ResearchService } from './ResearchService';
import { outputRegistry } from '../outputs';
import { toStructureReport } from '../book/ManuscriptStructureService';
import {
  analyseManuscriptImport,
  sliceUnitText,
  type DetectedUnit,
  type ImportAnalysisInput,
  type ImportAnalysisResult,
  type RecommendedImportMode,
} from './ImportAnalyser';
import type { WorkType } from '../../shared/workModel';
import { mapDetectedUnitType } from '../../shared/structureUnit';
import { normalizeProjectWorkModel } from './projectWorkModel';

export interface ImportApplyInput {
  projectId: string;
  rawText: string;
  filename?: string;
  importMode: RecommendedImportMode;
  detectedUnits?: DetectedUnit[];
  workType?: WorkType;
}

export interface ImportApplyResult {
  projectId: string;
  importMode: RecommendedImportMode;
  chaptersCreated: number;
  researchNotesCreated: number;
  unitTitles: string[];
}

export class ImportService {
  private readonly projectService = new ProjectService();
  private readonly chapterService = new ChapterService();
  private readonly researchService = new ResearchService();

  analyse(input: ImportAnalysisInput): ImportAnalysisResult {
    return analyseManuscriptImport(input);
  }

  async apply(input: ImportApplyInput, user: UserPublic): Promise<ImportApplyResult> {
    const project = await this.projectService.getProject(input.projectId, user);
    const rawText = input.rawText.trim();
    if (!rawText) {
      throw new Error('rawText is required to apply an import.');
    }

    const filename = input.filename?.trim() || 'uploaded manuscript';
    const units = input.detectedUnits ?? analyseManuscriptImport({
      rawText,
      filename: input.filename,
      declaredWorkType: input.workType ?? project.workType,
    }).detectedUnits;

    if (input.workType && input.workType !== project.workType) {
      await this.projectService.updateProject(
        input.projectId,
        normalizeProjectWorkModel(project, { workType: input.workType, workflowStage: 'imported' }),
        user,
      );
    } else {
      await this.projectService.updateProject(
        input.projectId,
        { workflowStage: 'imported' },
        user,
      );
    }

    const existing = await this.chapterService.listChapters(input.projectId);
    let order = existing.length;
    const unitTitles: string[] = [];
    let chaptersCreated = 0;
    let researchNotesCreated = 0;

    switch (input.importMode) {
      case 'whole-manuscript-source': {
        const chapter = await this.chapterService.createChapter({
          projectId: input.projectId,
          title: `Source manuscript: ${filename}`,
          content: rawText,
          order: order + 1,
          status: 'draft',
          unitType: 'section',
          unitStatus: 'source',
          sourceRole: 'original',
        });
        unitTitles.push(chapter.title);
        chaptersCreated = 1;
        break;
      }
      case 'single-unit': {
        const title = units[0]?.title || `Imported draft — ${filename}`;
        const unitType = mapDetectedUnitType(units[0]?.type ?? 'chapter');
        const chapter = await this.chapterService.createChapter({
          projectId: input.projectId,
          title,
          content: rawText,
          order: order + 1,
          status: 'draft',
          unitType,
          unitStatus: 'draft',
          sourceRole: 'imported',
        });
        unitTitles.push(chapter.title);
        chaptersCreated = 1;
        break;
      }
      case 'split-into-units': {
        if (units.length === 0) {
          throw new Error('No structural units detected to split. Choose whole manuscript source instead.');
        }
        for (const unit of units) {
          order += 1;
          const content = sliceUnitText(rawText, unit);
          if (!content.trim()) continue;
          const chapter = await this.chapterService.createChapter({
            projectId: input.projectId,
            title: unit.title,
            content,
            order,
            status: 'draft',
            unitType: mapDetectedUnitType(unit.type),
            unitStatus: 'draft',
            sourceRole: 'imported',
          });
          unitTitles.push(chapter.title);
          chaptersCreated += 1;
        }
        break;
      }
      case 'research-notes': {
        const note = await this.researchService.createNote({
          projectId: input.projectId,
          title: `Imported research — ${filename}`,
          content: rawText,
          tags: ['imported', 'research-desk'],
        });
        unitTitles.push(note.title);
        researchNotesCreated = 1;
        break;
      }
      default:
        throw new Error(`Unknown import mode: ${input.importMode as string}`);
    }

    await this.saveStructureReport(input.projectId, rawText, filename, input.workType ?? project.workType);

    return {
      projectId: input.projectId,
      importMode: input.importMode,
      chaptersCreated,
      researchNotesCreated,
      unitTitles,
    };
  }

  private async saveStructureReport(
    projectId: string,
    rawText: string,
    filename?: string,
    workType?: WorkType,
  ): Promise<void> {
    const analysis = analyseManuscriptImport({
      rawText,
      filename,
      declaredWorkType: workType,
    });
    const report = toStructureReport(analysis, { projectId });
    await outputRegistry.register({
      projectId,
      type: 'imported-source-analysis',
      title: `Manuscript structure report — ${filename ?? 'import'}`,
      path: '',
      metadata: { kind: 'manuscript-structure-report', ...report },
    });
  }
}

export const importService = new ImportService();
