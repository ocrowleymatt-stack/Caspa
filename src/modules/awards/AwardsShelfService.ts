import { aiWithFallback, getProjectFullText } from '../../shared/elevationHelpers';
import type {
  AssessmentStage,
  AwardFitResult,
  AwardLens,
  ProseAssessment,
  ProjectAwardsShelf,
} from '../../shared/awardsShelf';
import { AWARDS_SHELF_DISCLAIMER } from '../../shared/awardsShelf';
import { ProjectService } from '../manuscript/ProjectService';
import { outputRegistry } from '../outputs';
import { awardReadinessScorer } from '../wonder';
import { awardsCatalog } from './AwardsCatalog';

function proseFromDimensions(dimensions: {
  emotionalDepth: number;
  craft: number;
  originality: number;
  thematicResonance: number;
  commercialAppeal: number;
}): ProseAssessment {
  return {
    voice: dimensions.craft,
    control: Math.round((dimensions.craft + dimensions.thematicResonance) / 2),
    originality: dimensions.originality,
    structure: dimensions.thematicResonance,
    emotionalForce: dimensions.emotionalDepth,
    language: dimensions.craft,
    pace: dimensions.commercialAppeal,
    depth: Math.round((dimensions.emotionalDepth + dimensions.thematicResonance) / 2),
  };
}

function categoryWeight(lens: AwardLens, prose: ProseAssessment): number {
  const focus = lens.rubricFocus.join(' ').toLowerCase();
  if (focus.includes('plot') || focus.includes('pace')) return prose.pace;
  if (focus.includes('voice') || focus.includes('craft')) return prose.voice;
  if (focus.includes('original') || focus.includes('innov')) return prose.originality;
  if (focus.includes('structure') || focus.includes('act')) return prose.structure;
  if (focus.includes('emotion') || focus.includes('depth')) return prose.emotionalForce;
  if (focus.includes('stage') || focus.includes('visual')) return Math.round((prose.structure + prose.pace) / 2);
  return Math.round(
    (prose.voice + prose.originality + prose.structure + prose.emotionalForce) / 4,
  );
}

function fallbackFit(lens: AwardLens, prose: ProseAssessment, overall: number): AwardFitResult {
  const score = Math.round((categoryWeight(lens, prose) + overall) / 2);
  return {
    awardId: lens.id,
    awardName: lens.name,
    score,
    strengths: [`Shows promise on ${lens.rubricFocus[0] ?? 'core craft'}`],
    risks: [`May need stronger alignment with ${lens.inspiredBy}`],
    judgeComments: `Inspired-by assessment for ${lens.name}: promising draft with room to sharpen ${lens.rubricFocus.slice(0, 2).join(' and ') || 'craft'}.`,
    recommendedRevisions: [`Deepen ${lens.rubricFocus[0] ?? 'structure'} before submission.`],
    disqualificationOrMismatchRisks: lens.category === 'theatre'
      ? ['Confirm work is stage-ready rather than prose-forward.']
      : [],
  };
}

export class AwardsShelfService {
  private readonly projectService = new ProjectService();

  listCatalog() {
    return awardsCatalog.listAll();
  }

  createCustomAward(input: Parameters<typeof awardsCatalog.createCustom>[0]) {
    return awardsCatalog.createCustom(input);
  }

  async getProjectShelf(projectId: string, user?: import('../auth/types').UserPublic): Promise<ProjectAwardsShelf> {
    const project = await this.projectService.getProject(projectId, user);
    const selectedAwardIds = project.targetPrizeIds ?? [];
    const awards = await awardsCatalog.resolveByIds(selectedAwardIds);
    return { projectId, selectedAwardIds, awards };
  }

  async updateProjectShelf(
    projectId: string,
    selectedAwardIds: string[],
    user?: import('../auth/types').UserPublic,
  ): Promise<ProjectAwardsShelf> {
    const resolved = await awardsCatalog.resolveByIds(selectedAwardIds);
    if (resolved.length !== selectedAwardIds.length) {
      throw new Error('One or more award IDs are invalid');
    }
    await this.projectService.updateProject(projectId, { targetPrizeIds: selectedAwardIds }, user);
    return { projectId, selectedAwardIds, awards: resolved };
  }

  async assess(input: {
    projectId: string;
    awardIds: string[];
    sourceText?: string;
    workType?: string;
    stage?: AssessmentStage;
    user?: import('../auth/types').UserPublic;
  }) {
    const project = await this.projectService.getProject(input.projectId, input.user);
    const lenses = await awardsCatalog.resolveByIds(input.awardIds);
    if (lenses.length === 0) {
      throw new Error('At least one valid awardId is required');
    }

    const stage = input.stage ?? 'draft';
    const sourceText = input.sourceText?.trim()
      || (await getProjectFullText(input.projectId, 8000));
    const readiness = await awardReadinessScorer.scoreProject(input.projectId);
    const proseAssessment = proseFromDimensions(readiness.dimensions);

    const awardFit: AwardFitResult[] = [];
    for (const lens of lenses) {
      const { text } = await aiWithFallback(
        [
          `You are simulating an inspired-by judges panel for: ${lens.inspiredBy}.`,
          'Do NOT claim official criteria. Return JSON only:',
          '{ "score": 0-100, "strengths": [], "risks": [], "judgeComments": "...", "recommendedRevisions": [], "disqualificationOrMismatchRisks": [] }',
          `Rubric focus: ${lens.rubricFocus.join(', ')}`,
          `Stage: ${stage}`,
        ].join('\n'),
        sourceText.slice(0, 5000),
        JSON.stringify(fallbackFit(lens, proseAssessment, readiness.overall)),
        input.projectId,
      );

      let parsed: Partial<AwardFitResult> = {};
      try {
        const match = text.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) as Partial<AwardFitResult> : {};
      } catch {
        parsed = fallbackFit(lens, proseAssessment, readiness.overall);
      }

      const fallback = fallbackFit(lens, proseAssessment, readiness.overall);
      awardFit.push({
        awardId: lens.id,
        awardName: lens.name,
        score: typeof parsed.score === 'number' ? Math.min(100, Math.max(0, Math.round(parsed.score))) : fallback.score,
        strengths: parsed.strengths?.length ? parsed.strengths : fallback.strengths,
        risks: parsed.risks?.length ? parsed.risks : fallback.risks,
        judgeComments: parsed.judgeComments?.trim() || fallback.judgeComments,
        recommendedRevisions: parsed.recommendedRevisions?.length ? parsed.recommendedRevisions : fallback.recommendedRevisions,
        disqualificationOrMismatchRisks: parsed.disqualificationOrMismatchRisks ?? fallback.disqualificationOrMismatchRisks,
      });
    }

    const overallReadiness = Math.round(
      awardFit.reduce((sum, fit) => sum + fit.score, readiness.overall) / (awardFit.length + 1),
    );

    const result = {
      projectId: input.projectId,
      overallReadiness,
      awardFit,
      proseAssessment,
      stage,
      workType: input.workType ?? project.workType ?? project.genre,
      disclaimer: AWARDS_SHELF_DISCLAIMER,
      createdAt: new Date().toISOString(),
    };

    const record = await outputRegistry.register({
      projectId: input.projectId,
      type: 'award-assessment',
      title: `Judges' assessment — ${lenses.map((l) => l.name).slice(0, 2).join(' · ')}`,
      path: '',
      metadata: {
        kind: 'award-assessment',
        ...result,
        destination: 'writing-history',
      },
    });

    return { ...result, outputId: record.id };
  }
}

export const awardsShelfService = new AwardsShelfService();
