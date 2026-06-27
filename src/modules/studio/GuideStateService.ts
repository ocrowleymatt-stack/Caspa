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
    const hasBrief = Boolean(brief.productType && brief.successCriteria);
    const hasBible = Boolean(bible?.premise?.trim());
    const hasBookMap = Boolean(bookMap?.finishRoadmap?.length);
    const hasChapters = chapters.length > 0;
    const hasOutputs = outputs.length > 0;
    const hasStructure = chapters.some((c) => c.title.toLowerCase().includes('chapter') || c.order > 1);

    let state: GuideProjectState = 'blank';
    if (hasOutputs && hasBookMap) state = 'export-ready';
    else if (hasOutputs) state = 'revising';
    else if (hasChapters && chapters.some((c) => (c.wordCount ?? 0) > 200)) state = 'drafting';
    else if (hasBookMap) state = 'book-map-ready';
    else if (hasBible) state = 'bible-ready';
    else if (hasStructure) state = 'structured';
    else if (hasChapters) state = 'manuscript-imported';
    else if (hasAssets) state = 'assets-uploaded';
    else if (project.description?.trim()) state = 'idea';

    const steps: GuideStep[] = [
      {
        id: 'assets',
        label: 'Add material',
        status: hasAssets ? 'done' : state === 'blank' || state === 'idea' ? 'recommended' : 'missing',
        actionPath: `/projects/${projectId}/sources`,
        explanation: 'Upload manuscripts, notes, receipts, fragments — originals are preserved.',
      },
      {
        id: 'classify',
        label: 'Classify assets',
        status: hasAssets ? 'recommended' : 'optional',
        actionPath: `/projects/${projectId}/sources`,
        explanation: 'Tag what is research, prop, manuscript, or ignore for generation.',
      },
      {
        id: 'product',
        label: 'Choose product',
        status: hasBrief ? 'done' : 'recommended',
        actionPath: `/start?projectId=${projectId}`,
        explanation: 'Tell CASPA what finished product you want.',
      },
      {
        id: 'brief',
        label: 'Production Brief',
        status: hasBrief ? 'done' : 'missing',
        actionPath: `/start?projectId=${projectId}`,
        explanation: 'Define audience, tone, length, and success criteria.',
      },
      {
        id: 'bible',
        label: 'Project Bible',
        status: hasBible ? 'done' : hasBrief ? 'recommended' : 'optional',
        actionPath: `/projects/${projectId}/bible`,
        explanation: 'Premise, characters, themes, and structure.',
      },
      {
        id: 'structure',
        label: 'Analyse structure',
        status: hasStructure ? 'done' : hasChapters ? 'recommended' : 'optional',
        actionPath: `/projects/${projectId}/structure`,
        explanation: 'Detect chapters, scenes, and gaps without losing source text.',
      },
      {
        id: 'book-map',
        label: 'Book Map',
        status: hasBookMap ? 'done' : hasBible ? 'recommended' : 'optional',
        actionPath: `/projects/${projectId}/book-map`,
        explanation: 'Map arcs, missing chapters, and finish roadmap.',
      },
      {
        id: 'draft',
        label: 'Draft next section',
        status: hasOutputs ? 'done' : hasBookMap ? 'recommended' : 'optional',
        actionPath: `/casper?projectId=${projectId}`,
        explanation: 'Novel Write Pro — structured draft with critic room.',
      },
      {
        id: 'export',
        label: 'Export',
        status: hasOutputs ? 'optional' : 'missing',
        actionPath: `/projects/${projectId}/export`,
        explanation: 'Markdown, DOCX, or full archive when ready.',
      },
    ];

    const recommended = steps.find((s) => s.status === 'recommended' || s.status === 'missing') ?? steps[0];
    const secondaryActions = steps
      .filter((s) => s.id !== recommended.id && s.status !== 'done')
      .slice(0, 4)
      .map((s) => ({ label: s.label, path: s.actionPath ?? `/projects/${projectId}` }));

    const missingSteps = steps.filter((s) => s.status === 'missing').map((s) => s.label);
    const warnings: string[] = [];
    if (!hasAssets && !hasChapters) warnings.push('No source material yet — upload or paste before heavy generation.');
    if (hasAssets && !hasBrief) warnings.push('Production Brief not set — CASPA may not know what “finished” means.');

    return {
      projectId,
      state,
      missingSteps,
      recommendedNextAction: {
        label: recommended.label,
        path: recommended.actionPath ?? `/projects/${projectId}`,
        reason: recommended.explanation,
      },
      secondaryActions,
      warnings,
      confidence: hasBrief && hasBible ? 0.85 : hasAssets ? 0.6 : 0.35,
      steps,
    };
  }
}

export const guideStateService = new GuideStateService();
