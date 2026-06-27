import { ProjectService } from '../manuscript/ProjectService';
import { getProjectChapters } from '../../shared/elevationHelpers';
import { projectBibleService } from '../manuscript/ProjectBibleService';
import { bookMapService } from '../book/BookMapService';
import { outputRegistry } from '../outputs';
import { projectAssetService } from './ProjectAssetService';
import { productionBriefService } from './ProductionBriefService';
import type { GuideProjectState, GuideState, GuideStep } from './types';

export class GuideStateService {
  private readonly projectService = new ProjectService();

  async getGuideState(projectId: string, user?: import('../auth/types').UserPublic): Promise<GuideState> {
    const project = await this.projectService.getProject(projectId, user);
    const [assets, brief, bible, bookMap, chapters, outputs] = await Promise.all([
      projectAssetService.list(projectId, user),
      productionBriefService.get(projectId, user),
      projectBibleService.get(projectId).catch(() => null),
      bookMapService.get(projectId, user).catch(() => null),
      getProjectChapters(projectId),
      outputRegistry.list({ projectId }),
    ]);

    const hasAssets = assets.length > 0;
    const hasCreativeTarget = Boolean(
      brief.targetLength || brief.creativeTarget?.readerEffects?.length || brief.successCriteria,
    );
    const hasBrief = Boolean(brief.productType && (brief.successCriteria || hasCreativeTarget));
    const hasBible = Boolean(bible?.premise?.trim());
    const hasBookMap = Boolean(bookMap?.finishRoadmap?.length);
    const hasChapters = chapters.length > 0;
    const hasMultiUnits = chapters.filter((c) => (c.wordCount ?? 0) > 100).length >= 2;
    const hasOutputs = outputs.length > 0;
    const totalWords = chapters.reduce((sum, c) => sum + (c.wordCount ?? 0), 0);
    const targetWords = brief.targetLength ?? project.targetWordCount ?? 0;
    const needsExpansion = targetWords > 0 && totalWords < targetWords * 0.15;
    const missingSections = bookMap?.missingSections ?? [];
    const unappliedDraft = outputs.find(
      (o) =>
        !o.metadata?.applied &&
        ['novel-write-pro', 'continue-writing', 'next-chapter-draft', 'trash-to-treasure'].includes(
          String(o.metadata?.kind ?? o.type),
        ),
    );

    let state: GuideProjectState = 'blank';
    if (hasOutputs && hasBookMap && !needsExpansion) state = 'export-ready';
    else if (hasOutputs && unappliedDraft) state = 'revising';
    else if (hasChapters && totalWords > 500) state = 'drafting';
    else if (hasBookMap) state = 'book-map-ready';
    else if (hasBible) state = 'bible-ready';
    else if (hasMultiUnits) state = 'structured';
    else if (hasChapters) state = 'manuscript-imported';
    else if (hasAssets) state = 'assets-uploaded';
    else if (project.description?.trim()) state = 'idea';

    const steps: GuideStep[] = [
      {
        id: 'assets',
        label: 'Add material',
        status: hasAssets ? 'done' : 'recommended',
        actionPath: `/projects/${projectId}/sources`,
        explanation: 'Upload manuscripts, notes, receipts, fragments — originals preserved.',
      },
      {
        id: 'creative-target',
        label: 'Set creative target',
        status: hasCreativeTarget ? 'done' : hasAssets ? 'recommended' : 'missing',
        actionPath: `/start?projectId=${projectId}`,
        explanation: 'Target length, reader effect, and what finished means.',
      },
      {
        id: 'current-work',
        label: 'Open current work',
        status: hasChapters ? 'done' : hasAssets ? 'recommended' : 'missing',
        actionPath: `/projects/${projectId}/manuscript`,
        explanation: 'Read and work on the live manuscript — not Writing History.',
      },
      {
        id: 'structure',
        label: 'Create chapters/scenes',
        status: hasMultiUnits ? 'done' : hasChapters ? 'recommended' : hasAssets ? 'recommended' : 'optional',
        actionPath: `/projects/${projectId}/manuscript`,
        explanation: 'Analyse structure and split into chapters without losing source text.',
      },
      {
        id: 'bible',
        label: 'Project plan',
        status: hasBible ? 'done' : hasBrief ? 'recommended' : 'optional',
        actionPath: `/projects/${projectId}/bible`,
        explanation: 'Premise, characters, themes — feeds every draft.',
      },
      {
        id: 'book-map',
        label: 'Book Map',
        status: hasBookMap ? 'done' : hasBible ? 'recommended' : 'optional',
        actionPath: `/projects/${projectId}/book-map`,
        explanation: 'Missing chapters, arcs, finish roadmap.',
      },
      {
        id: 'expand',
        label: needsExpansion ? 'Build toward target length' : 'Expand a section',
        status: needsExpansion ? 'recommended' : 'optional',
        actionPath: `/projects/${projectId}/manuscript`,
        explanation: targetWords
          ? `${totalWords.toLocaleString()} / ${targetWords.toLocaleString()} words — expand or write missing sections.`
          : 'Expand or continue the section you are working on.',
      },
      {
        id: 'missing',
        label: 'Write next missing section',
        status: missingSections.length > 0 ? 'recommended' : 'optional',
        actionPath: `/projects/${projectId}/book-map`,
        explanation: missingSections.length
          ? `Missing: ${missingSections.slice(0, 3).join(', ')}`
          : 'Book Map will show gaps when ready.',
      },
      {
        id: 'apply',
        label: 'Review saved draft',
        status: unappliedDraft ? 'recommended' : hasOutputs ? 'optional' : 'missing',
        actionPath: unappliedDraft ? `/outputs/${unappliedDraft.id}` : `/projects/${projectId}/outputs`,
        explanation: 'Compare and apply safely — originals stay protected.',
      },
      {
        id: 'export',
        label: 'Export current work',
        status: hasChapters && totalWords > 1000 ? 'optional' : 'missing',
        actionPath: `/projects/${projectId}/export`,
        explanation: 'Markdown or DOCX from the current manuscript.',
      },
    ];

    const recommended =
      steps.find((s) => s.status === 'recommended' || s.status === 'missing') ?? steps[0];

    const secondaryActions = steps
      .filter((s) => s.id !== recommended.id && s.status !== 'done')
      .slice(0, 4)
      .map((s) => ({ label: s.label, path: s.actionPath ?? `/projects/${projectId}` }));

    const warnings: string[] = [];
    if (!hasAssets && !hasChapters) warnings.push('No source material yet — upload or paste before heavy generation.');
    if (hasAssets && !hasCreativeTarget) warnings.push('Creative Target not set — CASPA may not know length or reader effect.');
    if (unappliedDraft) warnings.push('A generated draft is waiting — review and apply from Writing History or Current Work.');
    if (needsExpansion && targetWords) {
      warnings.push(`Current work is ${Math.round((totalWords / targetWords) * 100)}% of target length.`);
    }

    return {
      projectId,
      state,
      missingSteps: steps.filter((s) => s.status === 'missing').map((s) => s.label),
      recommendedNextAction: {
        label: recommended.label,
        path: recommended.actionPath ?? `/projects/${projectId}/manuscript`,
        reason: recommended.explanation,
      },
      secondaryActions,
      warnings,
      confidence: hasBrief && hasBible ? 0.9 : hasChapters ? 0.75 : hasAssets ? 0.55 : 0.35,
      steps,
    };
  }
}

export const guideStateService = new GuideStateService();
