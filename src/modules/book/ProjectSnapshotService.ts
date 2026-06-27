import { generateId } from '../../shared';
import { readJsonFile, writeJsonFile, listJsonFiles } from '../../shared/fileStore';
import { getProjectChapters } from '../../shared/elevationHelpers';
import { ProjectService } from '../manuscript/ProjectService';
import type { ProjectSnapshot } from './types';

const SUB_PATH = 'project-snapshots';

function snapshotPath(projectId: string, snapshotId: string): string {
  return `${projectId}/${snapshotId}.json`;
}

export class ProjectSnapshotService {
  private readonly projectService = new ProjectService();

  async list(projectId: string, user?: import('../auth/types').UserPublic): Promise<ProjectSnapshot[]> {
    await this.projectService.getProject(projectId, user);
    const files = await listJsonFiles(`${SUB_PATH}/${projectId}`);
    const snapshots: ProjectSnapshot[] = [];
    for (const file of files) {
      const snap = await readJsonFile<ProjectSnapshot>(SUB_PATH, `${projectId}/${file}`);
      if (snap) snapshots.push(snap);
    }
    return snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async create(
    projectId: string,
    opts: { label?: string; reason?: string },
    user?: import('../auth/types').UserPublic,
  ): Promise<ProjectSnapshot> {
    await this.projectService.getProject(projectId, user);
    const chapters = await getProjectChapters(projectId);
    const snapshot: ProjectSnapshot = {
      id: generateId(),
      projectId,
      label: opts.label ?? `Snapshot ${new Date().toLocaleString()}`,
      reason: opts.reason ?? 'Manual snapshot',
      chapterSnapshots: chapters.map((chapter) => ({
        chapterId: chapter.id,
        title: chapter.title,
        content: chapter.content,
        wordCount: chapter.wordCount ?? chapter.content.split(/\s+/).filter(Boolean).length,
      })),
      createdAt: new Date().toISOString(),
    };
    await writeJsonFile(SUB_PATH, snapshotPath(projectId, snapshot.id), snapshot);
    return snapshot;
  }

  async restore(
    projectId: string,
    snapshotId: string,
    user?: import('../auth/types').UserPublic,
  ): Promise<{ restored: number }> {
    await this.projectService.getProject(projectId, user);
    const snapshot = await readJsonFile<ProjectSnapshot>(SUB_PATH, snapshotPath(projectId, snapshotId));
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    const { ChapterService } = await import('../manuscript/ChapterService');
    const chapterService = new ChapterService();
    let restored = 0;
    for (const entry of snapshot.chapterSnapshots) {
      await chapterService.updateChapter(entry.chapterId, {
        content: entry.content,
        title: entry.title,
        wordCount: entry.wordCount,
      });
      restored += 1;
    }
    return { restored };
  }

  async compare(
    projectId: string,
    fromId: string,
    toId: string,
    user?: import('../auth/types').UserPublic,
  ): Promise<{ from: ProjectSnapshot; to: ProjectSnapshot; wordDelta: number }> {
    await this.projectService.getProject(projectId, user);
    const from = await readJsonFile<ProjectSnapshot>(SUB_PATH, snapshotPath(projectId, fromId));
    const to = await readJsonFile<ProjectSnapshot>(SUB_PATH, snapshotPath(projectId, toId));
    if (!from || !to) {
      throw new Error('Snapshot not found for compare');
    }
    const fromWords = from.chapterSnapshots.reduce((s, c) => s + c.wordCount, 0);
    const toWords = to.chapterSnapshots.reduce((s, c) => s + c.wordCount, 0);
    return { from, to, wordDelta: toWords - fromWords };
  }
}

export const projectSnapshotService = new ProjectSnapshotService();
