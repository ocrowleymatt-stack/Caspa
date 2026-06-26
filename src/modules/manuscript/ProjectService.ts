import fs from 'fs/promises';
import path from 'path';
import {
  deleteById,
  emitEvent,
  findById,
  generateId,
  getConfig,
  logger,
  readCollection,
  upsert,
  writeCollection,
  type Chapter,
  type Character,
  type PlotPoint,
  type Project,
  type ResearchNote,
} from '../../shared';
import { assertProjectAccess, filterProjectsForUser } from '../auth/projectAccess';
import type { UserPublic } from '../auth/types';
import {
  applyWorkModelOnCreate,
  migrateProjectsWorkModel,
  normalizeProjectWorkModel,
} from './projectWorkModel';

const PROJECTS = 'projects';
const CHAPTERS = 'chapters';
const CHARACTERS = 'characters';
const PLOT_POINTS = 'plot-points';
const RESEARCH_NOTES = 'research-notes';

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

async function removeWhere<T>(
  collection: string,
  predicate: (item: T) => boolean,
): Promise<T[]> {
  const items = await readCollection<T & { id: string }>(collection);
  const removed = items.filter(predicate) as T[];
  const remaining = items.filter((item) => !predicate(item));
  await writeCollection(collection, remaining);
  return removed;
}

async function deleteChapterHistoryFiles(chapterIds: string[]): Promise<void> {
  const historyDir = path.join(getConfig().dataDir, 'history');

  await Promise.all(
    chapterIds.map(async (chapterId) => {
      try {
        await fs.unlink(path.join(historyDir, `${chapterId}.json`));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.warn(`Failed to delete chapter history for ${chapterId}: ${error}`);
        }
      }
    }),
  );
}

export class ProjectService {
  migrateWorkModel(): Promise<number> {
    return migrateProjectsWorkModel();
  }

  async listProjects(user: UserPublic): Promise<Project[]> {
    const projects = await readCollection<Project>(PROJECTS);
    return filterProjectsForUser(projects, user).map((project) =>
      this.ensureWorkModel(project),
    );
  }

  private ensureWorkModel(project: Project): Project {
    if (project.workType && project.structureType && project.form) {
      return project;
    }
    const normalized = normalizeProjectWorkModel(project);
    void upsert(PROJECTS, normalized);
    return normalized;
  }

  async getProject(id: string, user?: UserPublic): Promise<Project> {
    const project = await findById<Project>(PROJECTS, id);
    if (!project) {
      throw new NotFoundError(`Project not found: ${id}`);
    }
    const normalized = this.ensureWorkModel(project);
    if (user) {
      assertProjectAccess(normalized, user);
    }
    return normalized;
  }

  async createProject(
    data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'currentWordCount'>,
    ownerId: string,
    options?: { hasImportedManuscript?: boolean },
  ): Promise<Project> {
    const now = new Date().toISOString();
    const withWorkModel = applyWorkModelOnCreate(data, options);
    const project: Project = {
      ...withWorkModel,
      id: generateId(),
      ownerId,
      currentWordCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await upsert(PROJECTS, project);
    emitEvent('project:created', project);
    logger.info(`Created project: ${project.id} (${project.workType})`);
    return project;
  }

  async updateProject(id: string, data: Partial<Project>, user?: UserPublic): Promise<Project> {
    const existing = await this.getProject(id, user);
    const { id: _id, createdAt: _createdAt, ...updates } = data;

    const merged: Project = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const project = normalizeProjectWorkModel(merged, updates);

    await upsert(PROJECTS, project);
    emitEvent('project:updated', project);
    return project;
  }

  async deleteProject(id: string, user?: UserPublic): Promise<void> {
    await this.getProject(id, user);

    const chapters = await removeWhere<Chapter>(
      CHAPTERS,
      (chapter) => chapter.projectId === id,
    );
    await deleteChapterHistoryFiles(chapters.map((chapter) => chapter.id));

    await removeWhere<Character>(CHARACTERS, (character) => character.projectId === id);
    await removeWhere<PlotPoint>(PLOT_POINTS, (plot) => plot.projectId === id);
    await removeWhere<ResearchNote>(RESEARCH_NOTES, (note) => note.projectId === id);

    await deleteById(PROJECTS, id);
    emitEvent('project:deleted', { id });
    logger.info(`Deleted project and related data: ${id}`);
  }

  async recalculateWordCount(projectId: string): Promise<number> {
    const chapters = await readCollection<Chapter>(CHAPTERS);
    const total = chapters
      .filter((chapter) => chapter.projectId === projectId)
      .reduce((sum, chapter) => sum + chapter.wordCount, 0);

    const project = await this.getProject(projectId);
    if (project.currentWordCount !== total) {
      await this.updateProject(projectId, { currentWordCount: total });
    }

    return total;
  }

  async getProjectStats(projectId: string, user?: UserPublic): Promise<{
    wordCount: number;
    chapterCount: number;
    characterCount: number;
    plotPointCount: number;
    noteCount: number;
  }> {
    await this.getProject(projectId, user);

    const [chapters, characters, plotPoints, notes] = await Promise.all([
      readCollection<Chapter>(CHAPTERS),
      readCollection<Character>(CHARACTERS),
      readCollection<PlotPoint>(PLOT_POINTS),
      readCollection<ResearchNote>(RESEARCH_NOTES),
    ]);

    const projectChapters = chapters.filter((chapter) => chapter.projectId === projectId);

    return {
      wordCount: projectChapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
      chapterCount: projectChapters.length,
      characterCount: characters.filter((character) => character.projectId === projectId).length,
      plotPointCount: plotPoints.filter((plot) => plot.projectId === projectId).length,
      noteCount: notes.filter((note) => note.projectId === projectId).length,
    };
  }
}
