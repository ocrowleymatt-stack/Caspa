import { aiWithFallback } from '../../shared/elevationHelpers';
import { ChapterService } from '../manuscript/ChapterService';
import { qualityOrchestrator } from '../quality/qualityOrchestrator';
import type { QualityGateStatus } from '../../shared/types';
import type { NovelWriteProMode } from './novelWritePro';

export interface NovelQualityPassRequest {
  projectId?: string;
  chapterId?: string;
  content?: string;
  mode?: NovelWriteProMode;
}

export interface NovelQualityFinding {
  gate: string;
  status: QualityGateStatus;
  score: number;
  issues: string[];
}

export interface NovelQualityPassResult {
  overallScore: number;
  status: QualityGateStatus;
  findings: NovelQualityFinding[];
  recommendedRewritePrompt: string;
  wordCount: number;
  mode: NovelWriteProMode;
}

const modeHints: Record<NovelWriteProMode, string> = {
  novel: 'Award-target literary fiction: vivid specificity, earned emotion, no AI sludge.',
  script: 'Stage/screen dialogue: playable lines, clear beats, minimal unfilmable exposition.',
  musical: 'Musical theatre: singable lyric clarity, stageable action, song placement logic.',
  adaptation: 'Faithful adaptation: preserve source intent while sharpening dramatic shape.',
  polish: 'Manuscript polish: tighten rhythm, cut filler, preserve author voice and story.',
  chaos: 'High-voltage experimental prose while keeping readable through-line.',
};

export class NovelQualityPassService {
  private readonly chapterService = new ChapterService();

  async assess(input: NovelQualityPassRequest): Promise<NovelQualityPassResult> {
    const mode = input.mode ?? 'novel';
    let content = input.content?.trim() ?? '';

    if (!content && input.chapterId) {
      const chapter = await this.chapterService.getChapter(input.chapterId);
      content = chapter.content ?? '';
    }

    if (!content.trim()) {
      throw new Error('content is required — provide text or chapterId');
    }

    const gateResult = qualityOrchestrator.checkText(content);
    const findings: NovelQualityFinding[] = gateResult.gates.map((g) => ({
      gate: g.gate,
      status: g.status,
      score: g.score,
      issues: [...g.issues, ...g.notes].filter(Boolean).slice(0, 6),
    }));

    let recommendedRewritePrompt = '';
    try {
      const { text } = await aiWithFallback(
        [
          'You are a senior literary editor. Return ONE paragraph rewrite prompt the author can paste into Novel Write Pro.',
          `Mode: ${mode}. ${modeHints[mode]}`,
          'Focus on the top 3 concrete fixes. No markdown. No bullet list.',
        ].join('\n'),
        content.slice(0, 8000),
        'Tighten prose, sharpen images, cut filler, and preserve the story beats already on the page.',
        input.projectId,
      );
      recommendedRewritePrompt = text.trim();
    } catch {
      recommendedRewritePrompt =
        'Revise for specificity, rhythm, and earned emotion. Cut generic filler and preserve the existing story beats.';
    }

    return {
      overallScore: gateResult.overallScore,
      status: gateResult.overallStatus,
      findings,
      recommendedRewritePrompt,
      wordCount: content.split(/\s+/).filter(Boolean).length,
      mode,
    };
  }
}

export const novelQualityPassService = new NovelQualityPassService();
