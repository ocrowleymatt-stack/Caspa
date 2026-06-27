import { aiWithFallback, getProjectFullText } from '../../shared/elevationHelpers';
import { buildCreativeSpecPrompt } from '../../shared/creativeSpecPrompt';
import type {
  GoldAntiFillerReport,
  GoldResearchAssessment,
  GoldStructuralAssessment,
  GoldSynthesisInput,
  GoldSynthesisResult,
  GoldSynthesisSourcesUsed,
} from '../../shared/goldSynthesis';
import { GOLD_SYNTHESIS_DISCLAIMER } from '../../shared/goldSynthesis';
import type { ProseAssessment } from '../../shared/awardsShelf';
import { awardsCatalog } from '../awards/AwardsCatalog';
import { buildStructureTree } from '../manuscript/structureUnitMigration';
import { bookMapService } from '../book/BookMapService';
import { ChapterService } from '../manuscript/ChapterService';
import { PlotService } from '../manuscript/PlotService';
import { projectBibleService } from '../manuscript/ProjectBibleService';
import { ProjectService } from '../manuscript/ProjectService';
import { ResearchService } from '../manuscript/ResearchService';
import { outputRegistry } from '../outputs';
import { productionBriefService } from '../studio/ProductionBriefService';
import { buildSourceFidelityContract, type GoldSourceLock } from './GoldSourceLockService';

function defaultProse(): ProseAssessment {
  return {
    voice: 60,
    control: 60,
    originality: 58,
    structure: 62,
    emotionalForce: 58,
    language: 60,
    pace: 55,
    depth: 57,
  };
}

async function loadOutputContext(projectId: string, outputId?: string) {
  if (!outputId) return null;
  const record = await outputRegistry.get(outputId);
  if (!record || record.projectId !== projectId) return null;
  return record;
}

export class GoldSynthesisService {
  private readonly projectService = new ProjectService();
  private readonly chapterService = new ChapterService();
  private readonly plotService = new PlotService();
  private readonly researchService = new ResearchService();

  async synthesize(
    input: GoldSynthesisInput,
    user?: import('../auth/types').UserPublic,
  ): Promise<GoldSynthesisResult> {
    const project = await this.projectService.getProject(input.projectId, user);
    const [bible, chapters, poles, notes, awardLenses, bookMap, brief] = await Promise.all([
      projectBibleService.get(input.projectId),
      this.chapterService.listChapters(input.projectId),
      this.plotService.listPlotPoints(input.projectId),
      this.researchService.listNotes(input.projectId),
      awardsCatalog.resolveByIds(project.targetPrizeIds ?? []),
      bookMapService.get(input.projectId, user),
      productionBriefService.get(input.projectId, user),
    ]);

    const confirmed = notes.filter((note) => note.verificationStatus === 'confirmed');
    const tree = buildStructureTree(chapters);

    const outputs = await outputRegistry.list({ projectId: input.projectId });
    const latestSwarm = outputs.find((record) => record.type === 'agent-swarm');
    const latestAward = outputs.find((record) => record.type === 'award-assessment');

    const swarmRecord = await loadOutputContext(
      input.projectId,
      input.swarmOutputId ?? latestSwarm?.id,
    );
    const awardRecord = await loadOutputContext(
      input.projectId,
      input.awardAssessmentOutputId ?? latestAward?.id,
    );

    const swarmConsensus = swarmRecord?.metadata?.consensus as {
      revisionPlan?: string[];
      fillerWarnings?: string[];
      summary?: string;
    } | undefined;

    const awardAssessment = awardRecord?.metadata as {
      overallReadiness?: number;
      proseAssessment?: ProseAssessment;
      awardFit?: Array<{ awardName: string; score: number; judgeComments: string }>;
    } | undefined;

    const sourceText = input.sourceLock?.sourceText?.trim()
      || input.sourceText?.trim()
      || (await getProjectFullText(input.projectId, input.sourceLock ? 120_000 : 8000));

    const creativeSpec = buildCreativeSpecPrompt(brief);

    const sourcesUsed: GoldSynthesisSourcesUsed = {
      projectBible: Boolean(bible.premise || bible.structure || bible.scenePlan.length),
      researchLibrary: confirmed.length > 0,
      awardsShelf: awardLenses.length > 0,
      agentSwarm: Boolean(swarmRecord),
      structureModel: chapters.length > 0,
      awardAssessment: Boolean(awardRecord),
    };

    const contextBlock = [
      `Project: ${project.title}`,
      `Work type: ${input.workType ?? project.workType ?? project.genre}`,
      `Form: ${project.form ?? 'book'}`,
      `Structure type: ${project.structureType ?? 'chapters'}`,
      `Target words: ${project.targetWordCount}`,
      `Current words: ${project.currentWordCount}`,
      sourcesUsed.projectBible
        ? `Bible premise: ${bible.premise}\nStructure: ${bible.structure}\nThemes: ${bible.themes.join(', ')}`
        : 'Bible: empty',
      bookMap
        ? `Book Map: ${bookMap.completionPercentage}% complete · next: ${bookMap.nextRecommendedChapter}\nMissing: ${bookMap.missingSections.join('; ')}\nRoadmap: ${bookMap.finishRoadmap.slice(0, 3).join(' → ')}`
        : 'Book Map: not generated',
      sourcesUsed.researchLibrary
        ? `Confirmed research:\n${confirmed.map((note) => `- ${note.title}`).join('\n')}`
        : 'Confirmed research: none',
      sourcesUsed.awardsShelf
        ? `Award lenses: ${awardLenses.map((lens) => lens.name).join('; ')}`
        : 'Award lenses: none selected',
      sourcesUsed.agentSwarm
        ? `Agent swarm consensus: ${swarmConsensus?.summary ?? 'available in linked output'}`
        : 'Agent swarm: no prior output',
      sourcesUsed.awardAssessment
        ? `Prior award assessment readiness: ${awardAssessment?.overallReadiness ?? 'see linked output'}`
        : 'Award assessment: none linked',
      `Structure units: ${chapters.length}, poles: ${poles.length}`,
      creativeSpec,
    ].join('\n\n');

    const fallbackPayload = {
      judgeAssessment: 'Draft shows promise — strengthen structure and verify research before submission.',
      structuralAssessment: {
        summary: `${tree.length} structure units with ${poles.length} pier poles.`,
        unitCount: chapters.length,
        poleCoverage: poles.length >= 2 ? 'Poles present' : 'Add structural poles before expanding',
        structureType: project.structureType,
        risks: poles.length < 2 ? ['Insufficient structural poles for length target'] : [],
      },
      proseAssessment: awardAssessment?.proseAssessment ?? defaultProse(),
      researchAssessment: {
        confirmedNoteCount: confirmed.length,
        unverifiedNoteCount: notes.length - confirmed.length,
        summary: confirmed.length
          ? 'Some confirmed research available for factual passages.'
          : 'No confirmed research — treat factual claims as unverified.',
        gaps: confirmed.length ? [] : ['Build confirmed research library before nonfiction factual expansion'],
        accuracyFlags: [],
      },
      antiFillerReport: {
        warnings: swarmConsensus?.fillerWarnings ?? [],
        justifiedExpansion: [],
        summary: 'Expand only where structure or research creates a documented need.',
      },
      revisionPlan: swarmConsensus?.revisionPlan?.length
        ? swarmConsensus.revisionPlan
        : ['Clarify opening pressure', 'Verify factual claims against research', 'Align ending with award lens expectations'],
    };

    const { text } = await aiWithFallback(
      [
        'Produce Gold synthesis JSON integrating all context. Do NOT duplicate full Awards or Swarm reports — reference them.',
        'Return JSON:',
        '{ "judgeAssessment": "...", "structuralAssessment": { "summary", "risks": [] }, "proseAssessment": { voice, control, originality, structure, emotionalForce, language, pace, depth },',
        '"researchAssessment": { "summary", "gaps": [], "accuracyFlags": [] }, "antiFillerReport": { "warnings": [], "summary": "..." }, "revisionPlan": [] }',
        `Stage: ${input.stage ?? 'draft'}`,
      ].join('\n'),
      `${contextBlock}\n\n--- SOURCE TEXT ---\n${sourceText.slice(0, input.sourceLock ? 12000 : 5000)}`,
      JSON.stringify(fallbackPayload),
      input.projectId,
    );

    let parsed: Partial<typeof fallbackPayload> = fallbackPayload;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = { ...fallbackPayload, ...JSON.parse(match[0]) };
    } catch {
      parsed = fallbackPayload;
    }

    const structuralAssessment: GoldStructuralAssessment = {
      summary: parsed.structuralAssessment?.summary ?? fallbackPayload.structuralAssessment.summary,
      unitCount: chapters.length,
      poleCoverage: poles.length >= 2 ? 'Poles mapped' : 'Needs pier poles',
      structureType: project.structureType,
      risks: parsed.structuralAssessment?.risks ?? fallbackPayload.structuralAssessment.risks,
    };

    const researchAssessment: GoldResearchAssessment = {
      confirmedNoteCount: confirmed.length,
      unverifiedNoteCount: notes.length - confirmed.length,
      summary: parsed.researchAssessment?.summary ?? fallbackPayload.researchAssessment.summary,
      gaps: parsed.researchAssessment?.gaps ?? fallbackPayload.researchAssessment.gaps,
      accuracyFlags: parsed.researchAssessment?.accuracyFlags ?? [],
    };

    const antiFillerReport: GoldAntiFillerReport = {
      warnings: [
        ...(parsed.antiFillerReport?.warnings ?? []),
        ...(swarmConsensus?.fillerWarnings ?? []),
      ].filter(Boolean),
      justifiedExpansion: parsed.antiFillerReport?.justifiedExpansion ?? [],
      summary: parsed.antiFillerReport?.summary ?? fallbackPayload.antiFillerReport.summary,
    };

    const proseAssessment: ProseAssessment = {
      ...defaultProse(),
      ...(parsed.proseAssessment ?? {}),
      ...(awardAssessment?.proseAssessment ?? {}),
    };

    const revisionPlan = parsed.revisionPlan?.length
      ? parsed.revisionPlan
      : fallbackPayload.revisionPlan;

    let improvedText: string | undefined;
    if (input.improveText && !input.sourceLock?.allowAdaptation) {
      const lockForFidelity: GoldSourceLock = input.sourceLock
        ? (input.sourceLock as GoldSourceLock)
        : {
        sourceLockId: 'inline',
        projectId: input.projectId,
        sourceType: 'current-manuscript' as const,
        title: 'Manuscript',
        wordCount: sourceText.split(/\s+/).filter(Boolean).length,
        sourceHash: '',
        sourcePreviewStart: sourceText.slice(0, 300),
        sourcePreviewEnd: sourceText.slice(-300),
        mode: 'improve-same-story' as const,
        preserveStory: true,
        preserveCharacters: true,
        preserveEvents: true,
        preserveChronology: true,
        preserveVoice: true,
        allowAdaptation: false,
        sourceText,
        createdAt: new Date().toISOString(),
      };

      const fidelity = buildSourceFidelityContract(lockForFidelity);

      const { text: revised } = await aiWithFallback(
        [
          fidelity,
          'Apply the Gold synthesis revision plan only. IMPROVE THE SAME STORY — do not replace with a different plot.',
          `Revision plan:\n${revisionPlan.join('\n')}`,
          creativeSpec,
          'Return improved text only.',
        ].join('\n\n'),
        sourceText.slice(0, input.sourceLock ? 50000 : 6000),
        sourceText.slice(0, 2000),
        input.projectId,
      );
      improvedText = revised.trim() || undefined;
    } else if (input.improveText) {
      const { text: revised } = await aiWithFallback(
        [
          'Adapt/reinvent mode — explicit opt-in.',
          `Revision plan:\n${revisionPlan.join('\n')}`,
          creativeSpec,
          'Return improved text only.',
        ].join('\n\n'),
        sourceText.slice(0, 50000),
        sourceText.slice(0, 2000),
        input.projectId,
      );
      improvedText = revised.trim() || undefined;
    }

    return {
      projectId: input.projectId,
      stage: input.stage ?? 'draft',
      workType: input.workType ?? project.workType ?? project.genre,
      targetWordCount: project.targetWordCount,
      form: project.form,
      judgeAssessment: parsed.judgeAssessment ?? fallbackPayload.judgeAssessment,
      structuralAssessment,
      proseAssessment,
      researchAssessment,
      antiFillerReport,
      revisionPlan,
      improvedText,
      sourcesUsed,
      disclaimer: GOLD_SYNTHESIS_DISCLAIMER,
      swarmOutputId: swarmRecord?.id,
      awardAssessmentOutputId: awardRecord?.id,
      createdAt: new Date().toISOString(),
    };
  }
}

export const goldSynthesisService = new GoldSynthesisService();
