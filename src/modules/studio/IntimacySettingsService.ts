import { writeJsonFile, readJsonFile } from '../../shared/fileStore';
import { ProjectService } from '../manuscript/ProjectService';
import type { HeatLevel, IntimacySettings } from './types';

function settingsPath(projectId: string): string {
  return `${projectId}.json`;
}

const DEFAULT_SETTINGS = (projectId: string): IntimacySettings => ({
  projectId,
  enabled: true,
  defaultHeatLevel: 0,
  adultOnly: false,
  askBeforeIncreasingHeat: true,
  clarificationMode: 'ambiguous-only',
  boundaries: ['fade to black by default', 'keep it emotionally led'],
  defaultTone: 'Romantic tension only unless scene requests more',
  consentRequirement: true,
  notes: '',
  updatedAt: new Date().toISOString(),
});

export class IntimacySettingsService {
  private readonly projectService = new ProjectService();

  async get(projectId: string, user?: import('../auth/types').UserPublic): Promise<IntimacySettings> {
    await this.projectService.getProject(projectId, user);
    const stored = await readJsonFile<IntimacySettings>('project-intimacy', settingsPath(projectId));
    return stored ?? DEFAULT_SETTINGS(projectId);
  }

  async patch(
    projectId: string,
    patch: Partial<IntimacySettings>,
    user?: import('../auth/types').UserPublic,
  ): Promise<IntimacySettings> {
    const current = await this.get(projectId, user);
    const updated: IntimacySettings = {
      ...current,
      ...patch,
      projectId,
      updatedAt: new Date().toISOString(),
    };
    await writeJsonFile('project-intimacy', settingsPath(projectId), updated);
    return updated;
  }
}

export const intimacySettingsService = new IntimacySettingsService();

export const HEAT_LEVEL_LABELS: Record<HeatLevel, string> = {
  0: 'No adult scenes — romance/attraction only if clean',
  1: 'Romantic tension only',
  2: 'Fade to black',
  3: 'Sensual but not graphic',
  4: 'Spicy adult romance',
  5: 'Explicit adult fiction (adult-only project)',
};
