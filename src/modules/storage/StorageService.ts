import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { ZipArchive } from 'archiver';
import extract from 'extract-zip';
import {
  config,
  eventBus,
  logger,
  readCollection,
  writeCollection,
} from '../../shared/index';
import type { Chapter, Character, Project } from '../../shared/index';

const COLLECTIONS = [
  'projects',
  'chapters',
  'characters',
  'plotPoints',
  'researchNotes',
] as const;

export class StorageService {
  private exportsDir(): string {
    return path.join(path.dirname(path.resolve(config.dataDir)), 'exports');
  }

  async ensureDataDirs(): Promise<void> {
    await fs.mkdir(config.dataDir, { recursive: true });
    await fs.mkdir(config.backupDir, { recursive: true });
    await fs.mkdir(this.exportsDir(), { recursive: true });
  }

  async backup(label?: string): Promise<string> {
    await this.ensureDataDirs();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = label ? `${timestamp}-${label}.zip` : `${timestamp}.zip`;
    const backupPath = path.join(config.backupDir, fileName);

    eventBus.emit('backup:started', { path: backupPath });
    logger.info(`Backup started: ${backupPath}`);

    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(backupPath);
      const archive = new ZipArchive({ zlib: { level: 9 } });

      output.on('close', () => resolve());
      output.on('error', reject);
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(path.resolve(config.dataDir), false);
      void archive.finalize();
    });

    eventBus.emit('backup:complete', { path: backupPath });
    logger.info(`Backup complete: ${backupPath}`);

    return backupPath;
  }

  async listBackups(): Promise<
    { name: string; size: number; createdAt: string }[]
  > {
    await this.ensureDataDirs();

    const entries = await fs.readdir(config.backupDir);
    const backups: { name: string; size: number; createdAt: string }[] = [];

    for (const entry of entries) {
      if (!entry.endsWith('.zip')) {
        continue;
      }

      const filePath = path.join(config.backupDir, entry);
      const stat = await fs.stat(filePath);
      backups.push({
        name: entry,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
      });
    }

    return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async restore(backupName: string): Promise<void> {
    await this.ensureDataDirs();

    const backupPath = path.join(config.backupDir, backupName);
    await fs.access(backupPath);

    const dataDir = path.resolve(config.dataDir);
    const entries = await fs.readdir(dataDir);

    for (const entry of entries) {
      await fs.rm(path.join(dataDir, entry), { recursive: true, force: true });
    }

    await extract(backupPath, { dir: dataDir });
    logger.info(`Restored backup: ${backupName}`);
  }

  async getStats(): Promise<{
    projects: number;
    chapters: number;
    characters: number;
    totalWords: number;
    dbSizeKb: number;
  }> {
    await this.ensureDataDirs();

    const projects = await readCollection<Project>('projects');
    const chapters = await readCollection<Chapter>('chapters');
    const characters = await readCollection<Character>('characters');
    const totalWords = chapters.reduce(
      (sum, chapter) => sum + chapter.wordCount,
      0,
    );
    const dbSizeKb = await this.getDirectorySizeKb(config.dataDir);

    return {
      projects: projects.length,
      chapters: chapters.length,
      characters: characters.length,
      totalWords,
      dbSizeKb,
    };
  }

  async exportDataAsJSON(): Promise<string> {
    await this.ensureDataDirs();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportPath = path.join(this.exportsDir(), `export-${timestamp}.json`);
    const payload: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      collections: {},
    };

    for (const collection of COLLECTIONS) {
      payload.collections = {
        ...(payload.collections as Record<string, unknown>),
        [collection]: await readCollection(collection),
      };
    }

    const dataDir = path.resolve(config.dataDir);
    try {
      const files = await fs.readdir(dataDir);
      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }

        const name = file.replace(/\.json$/, '');
        if ((COLLECTIONS as readonly string[]).includes(name)) {
          continue;
        }

        const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
        payload.collections = {
          ...(payload.collections as Record<string, unknown>),
          [name]: JSON.parse(content) as unknown,
        };
      }
    } catch {
      // data dir may be empty
    }

    await fs.writeFile(exportPath, JSON.stringify(payload, null, 2), 'utf-8');
    logger.info(`Exported data to ${exportPath}`);

    return exportPath;
  }

  async importDataFromJSON(filePath: string): Promise<void> {
    await this.ensureDataDirs();

    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content) as
      | Record<string, unknown[]>
      | { collections?: Record<string, unknown[]> };

    const collections =
      'collections' in parsed && parsed.collections
        ? parsed.collections
        : (parsed as Record<string, unknown[]>);

    for (const [name, data] of Object.entries(collections)) {
      if (!Array.isArray(data)) {
        throw new Error(`Collection "${name}" must be an array`);
      }

      await writeCollection(name, data);
    }

    logger.info(`Imported data from ${filePath}`);
  }

  private async getDirectorySizeBytes(dir: string): Promise<number> {
    let totalBytes = 0;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          totalBytes += await this.getDirectorySizeBytes(entryPath);
          continue;
        }

        if (entry.isFile()) {
          const stat = await fs.stat(entryPath);
          totalBytes += stat.size;
        }
      }
    } catch {
      return 0;
    }

    return totalBytes;
  }

  private async getDirectorySizeKb(dir: string): Promise<number> {
    const totalBytes = await this.getDirectorySizeBytes(dir);
    return Math.round((totalBytes / 1024) * 100) / 100;
  }
}
