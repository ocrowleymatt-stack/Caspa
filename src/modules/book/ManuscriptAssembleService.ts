import { ChapterService } from '../manuscript/ChapterService';
import { ProjectService } from '../manuscript/ProjectService';
import { outputRegistry } from '../outputs';
import { productionBriefService } from '../studio/ProductionBriefService';
import { expansionGapMessage } from '../../shared/creativeSpecPrompt';

export class ManuscriptAssembleService {
  private readonly projectService = new ProjectService();
  private readonly chapterService = new ChapterService();

  async assemble(projectId: string, user?: import('../auth/types').UserPublic) {
    const project = await this.projectService.getProject(projectId, user);
    const [chapters, brief, outputs] = await Promise.all([
      this.chapterService.listChapters(projectId),
      productionBriefService.get(projectId, user),
      outputRegistry.list({ projectId }),
    ]);

    const sorted = [...chapters].sort((a, b) => a.order - b.order);
    const sections = sorted.map((chapter) => {
      const relatedOutputs = outputs
        .filter((output) => {
          const unitId = output.metadata?.unitId ?? output.metadata?.sourceChapterId ?? output.metadata?.chapterId;
          return unitId === chapter.id;
        })
        .slice(0, 5)
        .map((output) => ({
          outputId: output.id,
          title: output.title,
          kind: output.metadata?.kind ?? output.type,
          hasText: Boolean(output.metadata?.text || output.metadata?.revisedText),
        }));

      return {
        unitId: chapter.id,
        title: chapter.title,
        order: chapter.order,
        wordCount: chapter.wordCount ?? (chapter.content ?? '').split(/\s+/).filter(Boolean).length,
        unitType: chapter.unitType,
        unitStatus: chapter.unitStatus,
        sourceRole: chapter.sourceRole,
        content: chapter.content ?? '',
        relatedOutputs,
      };
    });

    const fullText = sections
      .map((section) => `# ${section.title}\n\n${section.content}`)
      .join('\n\n');
    const currentWordCount = sections.reduce((sum, section) => sum + section.wordCount, 0);
    const targetWordCount = brief.targetLength ?? project.targetWordCount ?? 0;

    const warnings: string[] = [];
    const gap = expansionGapMessage(brief, currentWordCount);
    if (gap) warnings.push(gap);
    if (sections.length <= 1 && currentWordCount > 5000) {
      warnings.push('Manuscript may be unstructured — run structure analysis on Current Work.');
    }
    if (!sections.some((section) => section.content.trim())) {
      warnings.push('No readable chapter content yet — add material in Sources or Write.');
    }

    return {
      projectId,
      title: project.title,
      mode: 'read-only-assemble',
      currentWordCount,
      targetWordCount,
      completionPercent: targetWordCount > 0
        ? Math.min(100, Math.round((currentWordCount / targetWordCount) * 100))
        : 0,
      sections,
      fullText,
      warnings,
      exportReady: sections.some((section) => section.content.trim().length > 0),
      assembledAt: new Date().toISOString(),
    };
  }
}

export const manuscriptAssembleService = new ManuscriptAssembleService();
