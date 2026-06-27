import type { GoldReport } from '../../shared';
import type { GoldSynthesisStage } from '../../shared/goldSynthesis';
import { standardOutputProvenance } from '../../shared/outputSemantics';
import { ProjectService } from '../manuscript/ProjectService';
import { outputRegistry } from '../outputs';
import { goldPipeline } from './GoldPipeline';
import { goldSynthesisService } from './GoldSynthesisService';
import {
  assessGoldFidelity,
  type GoldSourceLock,
} from './GoldSourceLockService';

export interface GoldPassRunParams {
  projectId: string;
  sourceText: string;
  sourceLock?: GoldSourceLock | null;
  improveText?: boolean;
  stage?: GoldSynthesisStage;
  swarmOutputId?: string;
  awardAssessmentOutputId?: string;
  includeElevationSteps?: boolean;
  providedSource?: string;
  user?: import('../auth/types').UserPublic;
}

export interface GoldPassRunResult {
  outputId: string;
  improved: string;
  critique: string;
  synthesis: Awaited<ReturnType<typeof goldSynthesisService.synthesize>>;
  report?: GoldReport;
  fidelity?: ReturnType<typeof assessGoldFidelity>;
  driftBlocked?: boolean;
}

export class GoldPassRunService {
  private readonly projectService = new ProjectService();

  async execute(params: GoldPassRunParams): Promise<GoldPassRunResult> {
    const project = await this.projectService.getProject(params.projectId, params.user);

    const synthesis = await goldSynthesisService.synthesize({
      projectId: params.projectId,
      sourceText: params.sourceText,
      sourceLock: params.sourceLock ?? undefined,
      improveText: params.improveText ?? true,
      stage: params.stage,
      swarmOutputId: params.swarmOutputId,
      awardAssessmentOutputId: params.awardAssessmentOutputId,
      includeElevationSteps: params.includeElevationSteps,
    }, params.user);

    let report: GoldReport | undefined;
    if (params.includeElevationSteps) {
      report = await goldPipeline.run(params.projectId, { sourceText: params.sourceText });
    }

    const sourceLock = params.sourceLock ?? null;
    const improved = synthesis.improvedText ?? synthesis.revisionPlan.join('\n');
    const fidelity = sourceLock && synthesis.improvedText
      ? assessGoldFidelity(sourceLock.sourceText, synthesis.improvedText, sourceLock)
      : undefined;

    const driftBlocked = Boolean(
      fidelity && (fidelity.verdict === 'major-drift' || fidelity.verdict === 'different-story'),
    );

    const critique = [
      synthesis.judgeAssessment,
      `Structure: ${synthesis.structuralAssessment.summary}`,
      `Research: ${synthesis.researchAssessment.summary}`,
      `Anti-filler: ${synthesis.antiFillerReport.summary}`,
      fidelity ? `Fidelity: ${fidelity.verdict} (${fidelity.sameStoryScore}/100)` : '',
      driftBlocked ? 'WARNING: Gold Pass drifted from the source. Kept as alternative — not a safe revision.' : '',
    ].filter(Boolean).join('\n\n');

    const record = await outputRegistry.register({
      projectId: params.projectId,
      type: 'gold-pass',
      title: driftBlocked
        ? `Gold alternative (drift detected) — ${synthesis.stage}`
        : `Gold synthesis — ${synthesis.stage}`,
      path: '',
      metadata: {
        kind: 'gold-synthesis',
        ...standardOutputProvenance({
          workType: project.workType,
          sourceScope: sourceLock?.sourceType ?? (params.providedSource?.trim() ? 'provided-text' : 'whole-manuscript'),
          unitId: sourceLock?.unitId,
          unitTitle: sourceLock?.title,
          swarmOutputId: params.swarmOutputId,
          stage: synthesis.stage,
          targetAwardIds: project.targetPrizeIds,
        }),
        text: improved,
        critique,
        synthesis,
        reportId: report?.id,
        overallScore: report?.overallScore,
        overallStatus: report?.overallStatus,
        sourceLockId: sourceLock?.sourceLockId,
        sourceHash: sourceLock?.sourceHash,
        fidelity,
        driftBlocked,
        applyBlocked: driftBlocked,
        destination: sourceLock?.unitId ? 'beside-unit' : 'writing-history',
        sourceExcerpt: params.sourceText.slice(0, 500),
        sourceScope: sourceLock?.sourceType ?? (params.providedSource?.trim() ? 'provided-text' : 'full-project'),
      },
    });

    return {
      outputId: record.id,
      improved,
      critique,
      synthesis,
      report,
      fidelity,
      driftBlocked,
    };
  }
}

export const goldPassRunService = new GoldPassRunService();
