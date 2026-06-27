import { ChapterService } from '../manuscript/ChapterService';
import { ProjectService } from '../manuscript/ProjectService';
import { productionBriefService } from '../studio/ProductionBriefService';
import { bookMapService } from './BookMapService';
import { expansionGapMessage } from '../../shared/creativeSpecPrompt';
import { manuscriptStructureService } from './ManuscriptStructureService';

export class ManuscriptViewService {
  private readonly projectService = new ProjectService();
  private readonly chapterService = new ChapterService();

  async getManuscript(projectId: string, user?: import('../auth/types').UserPublic) {
    const project = await this.projectService.getProject(projectId, user);
    const [chapters, brief, bookMap] = await Promise.all([
      this.chapterService.listChapters(projectId),
      productionBriefService.get(projectId, user),
      bookMapService.get(projectId, user),
    ]);

    const sorted = [...chapters].sort((a, b) => a.order - b.order);
    const currentWordCount = sorted.reduce((sum, c) => sum + (c.wordCount ?? 0), 0);
    const targetWordCount = brief.targetLength ?? project.targetWordCount ?? 0;
    const completionPercent = targetWordCount > 0
      ? Math.min(100, Math.round((currentWordCount / targetWordCount) * 100))
      : 0;

    const missingChapters = bookMap?.missingSections ?? [];
    const warnings: string[] = [];
    const gap = expansionGapMessage(brief, currentWordCount);
    if (gap) warnings.push(gap);
    if (sorted.length <= 1 && sorted[0]?.content && sorted[0].content.length > 5000) {
      warnings.push('Manuscript may be unstructured — run structure analysis.');
    }

    return {
      projectId,
      title: project.title,
      productType: brief.productType,
      currentWordCount,
      targetWordCount,
      completionPercent,
      chapters: sorted.map((c) => ({
        id: c.id,
        title: c.title,
        order: c.order,
        wordCount: c.wordCount,
        status: c.status,
        unitType: c.unitType,
        unitStatus: c.unitStatus,
        sourceRole: c.sourceRole,
      })),
      missingChapters,
      warnings,
      exportReady: sorted.some((c) => (c.content?.trim().length ?? 0) > 0),
      updatedAt: sorted[sorted.length - 1]?.updatedAt ?? project.updatedAt,
    };
  }

  async suggestStructureFromAssets(projectId: string, user?: import('../auth/types').UserPublic) {
    const chapters = await this.chapterService.listChapters(projectId);
    if (chapters.length > 1) return null;
    return manuscriptStructureService.analyseProjectManuscript(projectId, user);
  }
}

export const manuscriptViewService = new ManuscriptViewService();
