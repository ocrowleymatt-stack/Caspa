import { writeJsonFile, readJsonFile } from '../../shared/fileStore';
import { ProjectService } from '../manuscript/ProjectService';
import { aiWithFallback } from '../../shared/elevationHelpers';
import { projectAssetService } from './ProjectAssetService';
import type { ProductionBrief, ProductType } from './types';

function briefPath(projectId: string): string {
  return `${projectId}.json`;
}

const DEFAULT_BRIEF: Omit<ProductionBrief, 'projectId' | 'updatedAt'> = {
  productType: 'novel',
  sourceAssets: [],
  excludedAssets: [],
  exportTargets: ['markdown', 'docx'],
  privacyMode: 'local-first',
  aiStrategy: 'Ollama first, cloud when allowed',
};

export class ProductionBriefService {
  private readonly projectService = new ProjectService();

  async get(projectId: string, user?: import('../auth/types').UserPublic): Promise<ProductionBrief> {
    await this.projectService.getProject(projectId, user);
    const stored = await readJsonFile<ProductionBrief>('project-production-brief', briefPath(projectId));
    if (stored) return stored;
    return { projectId, ...DEFAULT_BRIEF, updatedAt: new Date().toISOString() };
  }

  async patch(
    projectId: string,
    patch: Partial<ProductionBrief>,
    user?: import('../auth/types').UserPublic,
  ): Promise<ProductionBrief> {
    const current = await this.get(projectId, user);
    const updated: ProductionBrief = {
      ...current,
      ...patch,
      projectId,
      updatedAt: new Date().toISOString(),
    };
    await writeJsonFile('project-production-brief', briefPath(projectId), updated);
    return updated;
  }

  async generate(projectId: string, user?: import('../auth/types').UserPublic): Promise<ProductionBrief> {
    const project = await this.projectService.getProject(projectId, user);
    const assets = await projectAssetService.list(projectId, user);
    const assetSummary = assets.slice(0, 12).map((a) => `- ${a.title} (${a.detectedUse}, ${a.tags.join(', ')})`).join('\n');

    const { text } = await aiWithFallback(
      'Generate a Production Brief JSON for a creative project. Return JSON only: { productType, audience, tone, genre, marketPosition, awardTarget, targetLength, successCriteria, exportTargets }.',
      [
        `Project: ${project.title}`,
        `Description: ${project.description ?? ''}`,
        `Genre field: ${project.genre ?? ''}`,
        `Assets:\n${assetSummary || '(none yet)'}`,
      ].join('\n\n'),
      JSON.stringify({ productType: 'novel', audience: 'Adult literary readers', tone: 'Vivid, precise', genre: project.genre ?? 'Novel', targetLength: project.targetWordCount ?? 80000 }),
      projectId,
    );

    let parsed: Partial<ProductionBrief> = {};
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]) as Partial<ProductionBrief>;
    } catch {
      parsed = { productType: 'novel' as ProductType };
    }

    return this.patch(projectId, {
      productType: (parsed.productType as ProductType) ?? 'novel',
      audience: parsed.audience,
      tone: parsed.tone,
      genre: parsed.genre ?? project.genre,
      marketPosition: parsed.marketPosition,
      awardTarget: parsed.awardTarget,
      targetLength: parsed.targetLength ?? project.targetWordCount,
      successCriteria: parsed.successCriteria,
      sourceAssets: assets.map((a) => a.id),
      exportTargets: parsed.exportTargets ?? ['markdown', 'docx', 'archive'],
    }, user);
  }
}

export const productionBriefService = new ProductionBriefService();
