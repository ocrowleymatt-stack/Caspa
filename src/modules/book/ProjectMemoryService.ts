import { readJsonFile, writeJsonFile, listJsonFiles } from '../../shared/fileStore';
import { ProjectService } from '../manuscript/ProjectService';
import type { ProjectMemory } from './types';

const SUB_PATH = 'project-memory';

function memoryFilename(projectId: string): string {
  return `${projectId}.json`;
}

function emptyMemory(projectId: string): ProjectMemory {
  return {
    projectId,
    preferredStyle: '',
    bannedCliches: [],
    voiceSamples: [],
    characterFacts: [],
    unresolvedPlotThreads: [],
    continuityFacts: [],
    userCorrections: [],
    neverAgainRules: [],
    alwaysWriteRules: [],
    priorGoldCriticisms: [],
    priorSwarmConsensus: [],
    updatedAt: new Date().toISOString(),
  };
}

export class ProjectMemoryService {
  private readonly projectService = new ProjectService();

  async get(projectId: string, user?: import('../auth/types').UserPublic): Promise<ProjectMemory> {
    await this.projectService.getProject(projectId, user);
    const stored = await readJsonFile<ProjectMemory>(SUB_PATH, memoryFilename(projectId));
    return stored ?? emptyMemory(projectId);
  }

  async patch(
    projectId: string,
    patch: Partial<ProjectMemory>,
    user?: import('../auth/types').UserPublic,
  ): Promise<ProjectMemory> {
    const current = await this.get(projectId, user);
    const next: ProjectMemory = {
      ...current,
      ...patch,
      projectId,
      updatedAt: new Date().toISOString(),
    };
    await writeJsonFile(SUB_PATH, memoryFilename(projectId), next);
    return next;
  }

  async extractFromProject(projectId: string, user?: import('../auth/types').UserPublic): Promise<ProjectMemory> {
    const { projectBibleService } = await import('../manuscript/ProjectBibleService');
    const { outputRegistry } = await import('../outputs');
    const bible = await projectBibleService.get(projectId);
    const outputs = await outputRegistry.list({ projectId });
    const swarm = outputs.find((o) => o.type === 'agent-swarm');
    const gold = outputs.find((o) => o.type === 'gold-pass');

    const consensus = swarm?.metadata?.consensus as { revisionPlan?: string[]; doNotChange?: string[] } | undefined;
    const goldCritique = gold?.metadata?.critique as string | undefined;

    return this.patch(projectId, {
      preferredStyle: bible.tone,
      characterFacts: bible.characters.map((c) => `${c.name}: ${c.wound}`),
      unresolvedPlotThreads: bible.themes,
      alwaysWriteRules: bible.styleRules,
      priorSwarmConsensus: consensus?.revisionPlan ?? [],
      priorGoldCriticisms: goldCritique ? [goldCritique.slice(0, 500)] : [],
      neverAgainRules: consensus?.doNotChange ?? [],
    }, user);
  }
}

export const projectMemoryService = new ProjectMemoryService();
