import { aiWithFallback } from '../../shared/elevationHelpers';
import { ProjectService } from '../manuscript/ProjectService';
import { projectBibleService } from '../manuscript/ProjectBibleService';
import { outputRegistry } from '../outputs';
import { toStructureReport } from './ManuscriptStructureService';
import { analyseManuscriptImport } from '../manuscript/ImportAnalyser';
import type { UserPublic } from '../auth/types';

export type TrashDesiredOutcome =
  | 'finish'
  | 'fix'
  | 'rewrite'
  | 'structure'
  | 'rescue'
  | 'make commercial'
  | 'make literary'
  | 'make stageable';

export class TrashToTreasureService {
  private readonly projectService = new ProjectService();

  async rescue(input: {
    projectId?: string;
    title?: string;
    material: string;
    problem?: string;
    desiredOutcome: TrashDesiredOutcome;
    tone?: string;
    user?: UserPublic;
  }): Promise<Record<string, unknown>> {
    const material = input.material.trim();
    if (!material) {
      throw new Error('material is required');
    }

    let projectId = input.projectId?.trim();
    if (!projectId) {
      const title = input.title?.trim() || 'Rescued project';
      const ownerId = input.user?.id ?? 'local';
      const project = await this.projectService.createProject({
        title,
        genre: 'Novel',
        description: `Trash to Treasure rescue — ${input.desiredOutcome}`,
        targetWordCount: 80000,
        status: 'draft',
        workType: 'novel',
        fictionality: 'fiction',
        form: 'book',
        structureType: 'chapters',
      }, ownerId);
      projectId = project.id;
    } else {
      await this.projectService.getProject(projectId, input.user);
    }

    const structureAnalysis = analyseManuscriptImport({ rawText: material });
    const structureReport = toStructureReport(structureAnalysis, { projectId });

    const { text } = await aiWithFallback(
      [
        'Trash to Treasure — rescue rough material into a finishable book plan.',
        'Return JSON:',
        '{ "diagnosis", "rescuePlan", "revisedPremise", "bibleUpdates": { premise, themes, structure },',
        '"bookMapUpdates": { missingSections, finishRoadmap }, "rewrite": "sample opening or next chapter", "finishingRoadmap": [] }',
        'Warm tone. Nothing has been overwritten — original preserved.',
        'Do NOT collapse into a short essay.',
      ].join('\n'),
      [
        `Problem: ${input.problem ?? 'unspecified'}`,
        `Desired outcome: ${input.desiredOutcome}`,
        `Tone: ${input.tone ?? 'Clear, vivid, production-minded'}`,
        `Material (${structureReport.totalWords} words):\n${material.slice(0, 8000)}`,
        `Structure: ${structureReport.units.length} units detected, confidence ${structureReport.confidence}`,
      ].join('\n\n'),
      JSON.stringify({
        diagnosis: 'Rough material rescued. This has bones.',
        rescuePlan: ['Preserve original', 'Generate Bible', 'Generate Book Map', 'Draft next chapter'],
        revisedPremise: material.slice(0, 200),
        finishingRoadmap: ['Finish one chapter at a time'],
      }),
      projectId,
    );

    let parsed: Record<string, unknown> = {};
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      parsed = { diagnosis: 'Rough material rescued.', rescuePlan: ['Review structure report'] };
    }

    const bibleUpdates = parsed.bibleUpdates as Record<string, unknown> | undefined;
    if (bibleUpdates) {
      await projectBibleService.patch(projectId, {
        premise: String(bibleUpdates.premise ?? parsed.revisedPremise ?? ''),
        structure: String(bibleUpdates.structure ?? ''),
        themes: Array.isArray(bibleUpdates.themes) ? bibleUpdates.themes.map(String) : [],
      });
    }

    const record = await outputRegistry.register({
      projectId,
      type: 'other',
      title: `Trash to Treasure — ${input.title ?? 'rescued material'}`,
      path: '',
      metadata: {
        kind: 'trash-to-treasure',
        diagnosis: parsed.diagnosis ?? 'Rough material rescued.',
        rescuePlan: parsed.rescuePlan ?? [],
        revisedPremise: parsed.revisedPremise,
        bibleUpdates,
        bookMapUpdates: parsed.bookMapUpdates,
        rewrite: parsed.rewrite,
        finishingRoadmap: parsed.finishingRoadmap ?? parsed.finishRoadmap,
        text: typeof parsed.rewrite === 'string' ? parsed.rewrite : material.slice(0, 5000),
        originalPreserved: true,
        structureReport,
        desiredOutcome: input.desiredOutcome,
        warmCopy: [
          'Rough material rescued.',
          'This has bones.',
          'Here is the salvage plan.',
          'Nothing has been overwritten.',
        ],
      },
    });

    await outputRegistry.register({
      projectId,
      type: 'imported-source-analysis',
      title: 'Manuscript structure report — rescue',
      path: '',
      metadata: { kind: 'manuscript-structure-report', ...structureReport },
    });

    return {
      success: true,
      outputId: record.id,
      projectId,
      title: input.title ?? 'Rescued project',
      kind: 'trash-to-treasure',
      diagnosis: parsed.diagnosis,
      rescuePlan: parsed.rescuePlan,
      revisedPremise: parsed.revisedPremise,
      bibleUpdates,
      bookMapUpdates: parsed.bookMapUpdates,
      rewrite: parsed.rewrite,
      finishingRoadmap: parsed.finishingRoadmap,
      provider: 'caspa',
      model: 'mistral:latest',
      createdAt: record.createdAt,
    };
  }
}

export const trashToTreasureService = new TrashToTreasureService();
