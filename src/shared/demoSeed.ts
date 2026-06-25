import { readCollection, upsert, generateId } from '../shared/db';
import type { Project } from '../shared/types';
import { logger } from '../shared/logger';

const DEMO_TITLE = 'The Grey Lady of Bridgnorth';

export async function ensureDemoProject(): Promise<Project | null> {
  const projects = await readCollection<Project>('projects');
  const existing = projects.find((p) => p.title === DEMO_TITLE);
  if (existing) return existing;

  if (projects.length > 0) return null;

  const now = new Date().toISOString();
  const project: Project = {
    id: generateId(),
    title: DEMO_TITLE,
    genre: 'Historical Mystery',
    description:
      'A Victorian ghost story set in the shadow of Bridgnorth Castle — demo project for CASPA Studio.',
    targetWordCount: 75000,
    currentWordCount: 0,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };

  await upsert('projects', project);
  logger.info(`Demo project seeded: "${DEMO_TITLE}" (${project.id})`);
  return project;
}
