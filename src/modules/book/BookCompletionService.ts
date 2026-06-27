import { aiWithFallback, getProjectChapters } from '../../shared/elevationHelpers';
import { projectBibleService } from '../manuscript/ProjectBibleService';
import { ProjectService } from '../manuscript/ProjectService';
import { ChapterService } from '../manuscript/ChapterService';
import { outputRegistry } from '../outputs';
import { bookContextLoader } from './BookContextLoader';
import { bookMapService } from './BookMapService';
import type {
  BookCompletionPlan,
  FinishBookMode,
  MissingChapterSuggestion,
} from './types';

function parseMissingChapters(text: string, fallback: MissingChapterSuggestion[]): MissingChapterSuggestion[] {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]) as {
      missingChapters?: Array<Partial<MissingChapterSuggestion>>;
      nextBestChapter?: Partial<MissingChapterSuggestion>;
      finishRoadmap?: string[];
    };
    const missing = (parsed.missingChapters ?? []).map((item, index) => ({
      title: item.title?.trim() || fallback[index % fallback.length]?.title || `Missing chapter ${index + 1}`,
      purpose: item.purpose?.trim() || 'Moves the book toward completion.',
      estimatedWords: typeof item.estimatedWords === 'number' ? item.estimatedWords : 2500,
      priority: (item.priority === 'high' || item.priority === 'low' ? item.priority : 'medium') as MissingChapterSuggestion['priority'],
    }));
    return missing.length ? missing : fallback;
  } catch {
    return fallback;
  }
}

export class BookCompletionService {
  private readonly projectService = new ProjectService();
  private readonly chapterService = new ChapterService();

  async suggestNextChapters(input: {
    projectId: string;
    manuscriptText?: string;
    targetLength?: number;
    targetGenre?: string;
    desiredEnding?: string;
    user?: import('../auth/types').UserPublic;
  }): Promise<BookCompletionPlan> {
    const project = await this.projectService.getProject(input.projectId, input.user);
    const context = await bookContextLoader.load(input.projectId, input.user);
    const bookMap = (await bookMapService.get(input.projectId, input.user))
      ?? (await bookMapService.buildDraft(input.projectId, input.user));

    const fallbackMissing: MissingChapterSuggestion[] = (bookMap.missingSections.length
      ? bookMap.missingSections
      : ['Midpoint reversal', 'Dark night chapter', 'Resolution']
    ).slice(0, 6).map((title, index) => ({
      title,
      purpose: 'Fills a structural gap toward a finished book.',
      estimatedWords: 2500,
      priority: index === 0 ? 'high' : 'medium',
    }));

    const { text } = await aiWithFallback(
      [
        'Suggest missing chapters for a FINISHED BOOK — chapter-scale units, not summaries.',
        'Return JSON: { "missingChapters": [{ "title", "purpose", "estimatedWords", "priority": "high|medium|low" }],',
        '"nextBestChapter": { ... }, "finishRoadmap": [] }',
        'Do not suggest writing the whole book in one pass.',
      ].join('\n'),
      [
        context.summaryBlock,
        input.manuscriptText ? `Manuscript excerpt:\n${input.manuscriptText.slice(0, 4000)}` : '',
        `Target genre: ${input.targetGenre ?? project.genre}`,
        `Target length: ${input.targetLength ?? project.targetWordCount}`,
        input.desiredEnding ? `Desired ending: ${input.desiredEnding}` : '',
        `Book map missing: ${bookMap.missingSections.join('; ')}`,
      ].filter(Boolean).join('\n\n'),
      JSON.stringify({
        missingChapters: fallbackMissing,
        nextBestChapter: fallbackMissing[0],
        finishRoadmap: bookMap.finishRoadmap,
      }),
      input.projectId,
    );

    const missingChapters = parseMissingChapters(text, fallbackMissing);
    const nextBestChapter = missingChapters[0] ?? null;

    let finishRoadmap = bookMap.finishRoadmap;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as { finishRoadmap?: string[] };
        if (parsed.finishRoadmap?.length) finishRoadmap = parsed.finishRoadmap;
      }
    } catch {
      // keep book map roadmap
    }

    const record = await outputRegistry.register({
      projectId: input.projectId,
      type: 'other',
      title: `Book completion plan — ${project.title}`,
      path: '',
      metadata: {
        kind: 'book-completion-plan',
        missingChapters,
        nextBestChapter,
        finishRoadmap,
      },
    });

    return {
      projectId: input.projectId,
      missingChapters,
      nextBestChapter,
      finishRoadmap,
      outputId: record.id,
    };
  }

  async finishBook(input: {
    projectId: string;
    mode: FinishBookMode;
    targetWords?: number;
    desiredOutcome?: string;
    currentText?: string;
    user?: import('../auth/types').UserPublic;
  }): Promise<Record<string, unknown>> {
    const project = await this.projectService.getProject(input.projectId, input.user);
    const context = await bookContextLoader.load(input.projectId, input.user);
    const bookMap = (await bookMapService.get(input.projectId, input.user))
      ?? (await bookMapService.buildDraft(input.projectId, input.user));
    const chapters = await getProjectChapters(input.projectId);
    const bible = await projectBibleService.get(input.projectId);

    const modePrompts: Record<FinishBookMode, string> = {
      diagnose: 'Diagnose manuscript state: strengths, gaps, weak sections, continuity risks. Return JSON with diagnosis, gaps, weakSections, nextAction.',
      plan: 'Produce a book-finish plan with ordered steps. Return JSON with finishRoadmap, missingChapters, nextBestChapter.',
      'write-next-chapter': 'Draft ONE missing chapter at full chapter scale (2000+ words target). Return JSON with title, chapterDraft, summary.',
      'fill-gap': 'Identify the highest-priority gap and draft a chapter-scale fill. Return JSON with gapTitle, chapterDraft.',
      'finish-roadmap': 'Produce a finish roadmap only — no full draft. Return JSON with finishRoadmap, milestones.',
    };

    const { text } = await aiWithFallback(
      [
        `Finish This Book — mode: ${input.mode}`,
        modePrompts[input.mode],
        'Use Project Bible, Book Map, chapters, swarm, research and gold context.',
        'Do NOT collapse the book into an essay or blurb.',
        'Do NOT attempt to write the entire book in one response.',
      ].join('\n'),
      [
        context.summaryBlock,
        `Bible premise: ${bible.premise}`,
        `Book map next: ${bookMap.nextRecommendedChapter}`,
        `Chapters: ${chapters.length}`,
        input.currentText ? `Current text:\n${input.currentText.slice(0, 5000)}` : '',
        input.desiredOutcome ? `Desired outcome: ${input.desiredOutcome}` : '',
      ].filter(Boolean).join('\n\n'),
      JSON.stringify({
        diagnosis: 'Manuscript has bones — gaps remain before finish.',
        finishRoadmap: bookMap.finishRoadmap,
        nextAction: bookMap.nextRecommendedChapter,
      }),
      input.projectId,
    );

    let parsed: Record<string, unknown> = {};
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      parsed = { raw: text.slice(0, 8000) };
    }

    const kind = input.mode === 'write-next-chapter' || input.mode === 'fill-gap'
      ? 'next-chapter-draft'
      : 'book-finish-plan';

    const chapterDraft = typeof parsed.chapterDraft === 'string' ? parsed.chapterDraft : undefined;

    const record = await outputRegistry.register({
      projectId: input.projectId,
      type: input.mode === 'write-next-chapter' || input.mode === 'fill-gap' ? 'novel-write-pro' : 'other',
      title: `Finish This Book — ${input.mode} · ${project.title}`,
      path: '',
      metadata: {
        kind,
        mode: input.mode,
        ...parsed,
        text: chapterDraft,
        provider: 'caspa',
        finishRoadmap: parsed.finishRoadmap ?? bookMap.finishRoadmap,
      },
    });

    if (chapterDraft && (input.mode === 'write-next-chapter' || input.mode === 'fill-gap')) {
      const title = typeof parsed.title === 'string'
        ? parsed.title
        : bookMap.nextRecommendedChapter;
      await this.chapterService.createChapter({
        projectId: input.projectId,
        title,
        content: chapterDraft,
        order: chapters.length + 1,
        status: 'draft',
        unitType: 'chapter',
        unitStatus: 'draft',
        sourceRole: 'ai-output',
      });
    }

    return {
      success: true,
      outputId: record.id,
      projectId: input.projectId,
      mode: input.mode,
      kind,
      ...parsed,
    };
  }
}

export const bookCompletionService = new BookCompletionService();
