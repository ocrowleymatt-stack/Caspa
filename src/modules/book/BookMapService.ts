import { readJsonFile, writeJsonFile } from '../../shared/fileStore';
import { aiWithFallback, getProjectChapters } from '../../shared/elevationHelpers';
import { buildCreativeSpecPrompt } from '../../shared/creativeSpecPrompt';
import { projectBibleService } from '../manuscript/ProjectBibleService';
import { productionBriefService } from '../studio/ProductionBriefService';
import { ProjectService } from '../manuscript/ProjectService';
import { outputRegistry } from '../outputs';
import type { BookMap, BookMapChapterEntry } from './types';

const SUB_PATH = 'book-maps';

function mapFilename(projectId: string): string {
  return `${projectId}.json`;
}

function chapterStatus(content: string, wordCount: number): BookMapChapterEntry['status'] {
  if (wordCount >= 1500) return 'complete';
  if (wordCount >= 200) return 'draft';
  if (content.trim()) return 'weak';
  return 'outline';
}

export class BookMapService {
  private readonly projectService = new ProjectService();

  async get(projectId: string, user?: import('../auth/types').UserPublic): Promise<BookMap | null> {
    await this.projectService.getProject(projectId, user);
    return readJsonFile<BookMap>(SUB_PATH, mapFilename(projectId));
  }

  async patch(
    projectId: string,
    patch: Partial<BookMap>,
    user?: import('../auth/types').UserPublic,
  ): Promise<BookMap> {
    const current = (await this.get(projectId, user)) ?? (await this.buildDraft(projectId, user));
    const next: BookMap = {
      ...current,
      ...patch,
      projectId,
      updatedAt: new Date().toISOString(),
    };
    await writeJsonFile(SUB_PATH, mapFilename(projectId), next);
    return next;
  }

  async buildDraft(projectId: string, user?: import('../auth/types').UserPublic): Promise<BookMap> {
    const project = await this.projectService.getProject(projectId, user);
    const [bible, chapters] = await Promise.all([
      projectBibleService.get(projectId),
      getProjectChapters(projectId),
    ]);

    const chapterEntries: BookMapChapterEntry[] = chapters.map((chapter, index) => ({
      unitId: chapter.id,
      order: chapter.order || index + 1,
      title: chapter.title,
      summary: chapter.content.slice(0, 180).replace(/\s+/g, ' ').trim() || 'Empty unit',
      wordCount: chapter.wordCount ?? chapter.content.split(/\s+/).filter(Boolean).length,
      status: chapterStatus(chapter.content, chapter.wordCount ?? 0),
    }));

    const totalWords = chapterEntries.reduce((sum, entry) => sum + entry.wordCount, 0);
    const target = project.targetWordCount || 80000;
    const completion = target > 0 ? Math.min(100, Math.round((totalWords / target) * 100)) : 0;

    const weakSections = chapterEntries.filter((c) => c.status === 'weak').map((c) => c.title);
    const missingSections = chapterEntries.filter((c) => c.status === 'outline' && !c.wordCount).map((c) => c.title);

    return {
      projectId,
      workingTitle: project.title,
      projectType: project.workType ?? project.form ?? 'book',
      genre: project.genre,
      premise: bible.premise || project.description?.slice(0, 400) || '',
      totalWords,
      targetWordCount: target,
      completionPercentage: completion,
      chapters: chapterEntries,
      arcSummary: bible.structure || 'Arc not yet mapped — generate Bible and Book Map.',
      characterArcs: bible.characters.map((c) => `${c.name}: ${c.wound} → ${c.desire}`),
      unresolvedThreads: bible.themes.length ? [...bible.themes] : [],
      duplicatedMaterial: [],
      weakSections,
      missingSections,
      continuityWarnings: totalWords > 0 && !bible.premise
        ? ['Project Bible is empty — continuity memory is thin.']
        : [],
      nextRecommendedChapter: chapterEntries.find((c) => c.status === 'outline' || c.status === 'weak')?.title
        || 'Chapter after latest draft',
      finishRoadmap: [
        'Confirm structure and original source preserved.',
        'Fill missing or weak chapters one at a time.',
        'Run Gold Pass before export.',
      ],
      updatedAt: new Date().toISOString(),
    };
  }

  async generate(projectId: string, user?: import('../auth/types').UserPublic): Promise<BookMap & { outputId: string }> {
    const draft = await this.buildDraft(projectId, user);
    const project = await this.projectService.getProject(projectId, user);
    const brief = await productionBriefService.get(projectId, user);
    const creativeSpec = buildCreativeSpecPrompt(brief);

    const { text } = await aiWithFallback(
      [
        'Generate a Book Map / Finish Map for this writing project.',
        'Return JSON only:',
        '{ "arcSummary": "...", "characterArcs": [], "unresolvedThreads": [], "duplicatedMaterial": [],',
        '"weakSections": [], "missingSections": [], "continuityWarnings": [], "nextRecommendedChapter": "...", "finishRoadmap": [] }',
        'Suggest missing chapters that move toward a FINISHED BOOK — not summaries.',
        'Do not collapse the manuscript into a short blurb.',
        creativeSpec,
      ].filter(Boolean).join('\n'),
      JSON.stringify({
        title: project.title,
        workType: project.workType,
        targetWordCount: project.targetWordCount,
        currentWords: draft.totalWords,
        premise: draft.premise,
        chapters: draft.chapters.map((c) => ({ title: c.title, words: c.wordCount, status: c.status })),
      }),
      JSON.stringify({
        arcSummary: draft.arcSummary,
        missingSections: ['Mid-book escalation chapter', 'Penultimate crisis chapter', 'Resolution chapter'],
        finishRoadmap: draft.finishRoadmap,
        nextRecommendedChapter: draft.nextRecommendedChapter,
      }),
      projectId,
    );

    let parsed: Partial<BookMap> = {};
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]) as Partial<BookMap>;
    } catch {
      parsed = {};
    }

    const mergedMissing = [
      ...new Set([
        ...(parsed.missingSections ?? []),
        ...draft.missingSections,
      ]),
    ].slice(0, 12);

    const bookMap: BookMap = {
      ...draft,
      arcSummary: parsed.arcSummary?.trim() || draft.arcSummary,
      characterArcs: parsed.characterArcs?.length ? parsed.characterArcs : draft.characterArcs,
      unresolvedThreads: parsed.unresolvedThreads?.length ? parsed.unresolvedThreads : draft.unresolvedThreads,
      duplicatedMaterial: parsed.duplicatedMaterial ?? [],
      weakSections: parsed.weakSections?.length ? parsed.weakSections : draft.weakSections,
      missingSections: mergedMissing,
      continuityWarnings: parsed.continuityWarnings?.length ? parsed.continuityWarnings : draft.continuityWarnings,
      nextRecommendedChapter: parsed.nextRecommendedChapter?.trim() || draft.nextRecommendedChapter,
      finishRoadmap: parsed.finishRoadmap?.length ? parsed.finishRoadmap : draft.finishRoadmap,
      updatedAt: new Date().toISOString(),
    };

    await writeJsonFile(SUB_PATH, mapFilename(projectId), bookMap);

    const record = await outputRegistry.register({
      projectId,
      type: 'other',
      title: `Book Map — ${project.title}`,
      path: '',
      metadata: {
        kind: 'book-map',
        ...bookMap,
        destination: 'writing-history',
      },
    });

    bookMap.generatedFromOutputId = record.id;
    await writeJsonFile(SUB_PATH, mapFilename(projectId), bookMap);

    return { ...bookMap, outputId: record.id };
  }
}

export const bookMapService = new BookMapService();
