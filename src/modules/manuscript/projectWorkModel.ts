import { readCollection, upsert, type Project } from '../../shared';
import {
  getDefaultsForWorkType,
  inferWorkModelFromLegacy,
  type WorkModelFields,
  type WorkType,
} from '../../shared/workModel';

const PROJECTS = 'projects';

export type ProjectWorkModelInput = Partial<WorkModelFields> & {
  genre?: string;
  description?: string;
};

function hasWorkModel(project: Project): boolean {
  return Boolean(project.workType && project.structureType && project.form);
}

export function normalizeProjectWorkModel(
  project: Project,
  input: ProjectWorkModelInput = {},
  options?: { hasImportedManuscript?: boolean },
): Project {
  const inferred = inferWorkModelFromLegacy({
    genre: input.genre ?? project.genre,
    description: input.description ?? project.description,
    hasImportedManuscript: options?.hasImportedManuscript,
  });

  const workType = (input.workType ?? project.workType ?? inferred.workType) as WorkType;
  const defaults = getDefaultsForWorkType(workType);

  return {
    ...project,
    workType,
    fictionality: input.fictionality ?? project.fictionality ?? defaults.fictionality,
    form: input.form ?? project.form ?? defaults.form,
    subgenre: input.subgenre ?? project.subgenre ?? inferred.subgenre,
    targetAudience: input.targetAudience ?? project.targetAudience,
    targetPrizeIds: input.targetPrizeIds ?? project.targetPrizeIds ?? [],
    targetMarket: input.targetMarket ?? project.targetMarket ?? defaults.targetMarket,
    structureType: input.structureType ?? project.structureType ?? defaults.structureType,
    workflowStage:
      input.workflowStage
      ?? project.workflowStage
      ?? (options?.hasImportedManuscript ? 'imported' : inferred.workflowStage),
  };
}

export function applyWorkModelOnCreate(
  data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'currentWordCount'>,
  options?: { hasImportedManuscript?: boolean },
): Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'currentWordCount'> {
  const draft = {
    ...data,
    id: 'pending',
    currentWordCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Project;

  return normalizeProjectWorkModel(draft, data, options);
}

export async function migrateProjectsWorkModel(): Promise<number> {
  const projects = await readCollection<Project>(PROJECTS);
  let updated = 0;

  for (const project of projects) {
    if (hasWorkModel(project)) continue;
    const normalized = normalizeProjectWorkModel(project);
    await upsert(PROJECTS, normalized);
    updated += 1;
  }

  return updated;
}
