import fs from 'fs/promises';
import path from 'path';
import {
  deleteById,
  emitEvent,
  findById,
  generateId,
  getConfig,
  readCollection,
  upsert,
  writeCollection,
  type Chapter,
} from '../../shared';
import { NotFoundError, ProjectService } from './ProjectService';
import { normalizeStructureUnit, migrateChaptersStructureModel } from './structureUnitMigration';

const CHAPTERS = 'chapters';
const MAX_HISTORY = 20;

export interface ChapterHistoryEntry {
  timestamp: string;
  wordCount: number;
  preview: string;
  content?: string;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

function contentPreview(content: string, maxLength = 120): string {
  const normalized = content.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

async function historyPath(chapterId: string): Promise<string> {
  const historyDir = path.join(getConfig().dataDir, 'history');
  await fs.mkdir(historyDir, { recursive: true });
  return path.join(historyDir, `${chapterId}.json`);
}

async function readHistory(chapterId: string): Promise<ChapterHistoryEntry[]> {
  try {
    const content = await fs.readFile(await historyPath(chapterId), 'utf-8');
    return JSON.parse(content) as ChapterHistoryEntry[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function appendHistory(chapter: Chapter): Promise<void> {
  const entry: ChapterHistoryEntry = {
    timestamp: new Date().toISOString(),
    wordCount: chapter.wordCount,
    preview: contentPreview(chapter.content),
    content: chapter.content,
  };

  const history = await readHistory(chapter.id);
  history.unshift(entry);
  const trimmed = history.slice(0, MAX_HISTORY);
  await fs.writeFile(await historyPath(chapter.id), JSON.stringify(trimmed, null, 2), 'utf-8');
}

export class ChapterService {
  private readonly projectService = new ProjectService();

  migrateStructureModel(): Promise<number> {
    return migrateChaptersStructureModel();
  }

  async listChapters(projectId: string): Promise<Chapter[]> {
    const project = await this.projectService.getProject(projectId).catch(() => undefined);
    const chapters = await readCollection<Chapter>(CHAPTERS);
    return chapters
      .filter((chapter) => chapter.projectId === projectId)
      .sort((a, b) => a.order - b.order)
      .map((chapter) => normalizeStructureUnit(chapter, project));
  }

  async getChapter(id: string): Promise<Chapter> {
    const chapter = await findById<Chapter>(CHAPTERS, id);
    if (!chapter) {
      throw new NotFoundError(`Chapter not found: ${id}`);
    }
    const project = await this.projectService.getProject(chapter.projectId).catch(() => undefined);
    const normalized = normalizeStructureUnit(chapter, project);
    if (!chapter.unitType) {
      await upsert(CHAPTERS, normalized);
    }
    return normalized;
  }

  async createChapter(
    data: Omit<Chapter, 'id' | 'createdAt' | 'updatedAt' | 'wordCount'>,
  ): Promise<Chapter> {
    const project = await this.projectService.getProject(data.projectId).catch(() => undefined);
    const now = new Date().toISOString();
    const draft: Chapter = {
      ...data,
      id: generateId(),
      content: data.content ?? '',
      wordCount: countWords(data.content ?? ''),
      metadata: data.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    const chapter = normalizeStructureUnit(draft, project);

    await upsert(CHAPTERS, chapter);
    emitEvent('chapter:created', chapter);
    await this.projectService.recalculateWordCount(chapter.projectId);
    return chapter;
  }

  async updateChapter(id: string, data: Partial<Chapter>): Promise<Chapter> {
    const existing = await this.getChapter(id);
    const contentChanged =
      data.content !== undefined && data.content !== existing.content;

    if (contentChanged) {
      await appendHistory(existing);
    }

    const content = data.content ?? existing.content;
    const chapter: Chapter = normalizeStructureUnit({
      ...existing,
      ...data,
      id: existing.id,
      projectId: existing.projectId,
      content,
      wordCount: countWords(content),
      metadata: data.metadata ?? existing.metadata ?? {},
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }, await this.projectService.getProject(existing.projectId).catch(() => undefined));

    await upsert(CHAPTERS, chapter);
    emitEvent('chapter:updated', chapter);
    await this.projectService.recalculateWordCount(chapter.projectId);
    return chapter;
  }

  async deleteChapter(id: string): Promise<void> {
    const chapter = await this.getChapter(id);
    await deleteById(CHAPTERS, id);
    emitEvent('chapter:deleted', { id, projectId: chapter.projectId });
    await this.projectService.recalculateWordCount(chapter.projectId);

    try {
      await fs.unlink(await historyPath(id));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async reorderChapters(projectId: string, orderedIds: string[]): Promise<void> {
    const chapters = await this.listChapters(projectId);
    const chapterMap = new Map(chapters.map((chapter) => [chapter.id, chapter]));

    if (orderedIds.length !== chapters.length) {
      throw new Error('orderedIds must include all chapters for the project');
    }

    for (const chapterId of orderedIds) {
      if (!chapterMap.has(chapterId)) {
        throw new Error(`Chapter ${chapterId} does not belong to project ${projectId}`);
      }
    }

    const now = new Date().toISOString();
    const updated = orderedIds.map((chapterId, index) => ({
      ...chapterMap.get(chapterId)!,
      order: index,
      updatedAt: now,
    }));

    const allChapters = await readCollection<Chapter>(CHAPTERS);
    const updatedMap = new Map(updated.map((chapter) => [chapter.id, chapter]));
    const nextChapters = allChapters.map(
      (chapter) => updatedMap.get(chapter.id) ?? chapter,
    );
    await writeCollection(CHAPTERS, nextChapters);
  }

  async getChapterHistory(chapterId: string): Promise<ChapterHistoryEntry[]> {
    await this.getChapter(chapterId);
    return readHistory(chapterId);
  }

  async restoreChapter(chapterId: string, timestamp: string): Promise<Chapter> {
    await this.getChapter(chapterId);
    const history = await readHistory(chapterId);
    const entry = history.find((item) => item.timestamp === timestamp);
    if (!entry?.content) {
      throw new Error(`History version not found or has no restorable content: ${timestamp}`);
    }
    return this.updateChapter(chapterId, { content: entry.content });
  }
}
