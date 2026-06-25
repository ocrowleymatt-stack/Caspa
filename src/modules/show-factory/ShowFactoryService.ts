import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { ZipArchive } from 'archiver';
import {
  config,
  deleteById,
  emitEvent,
  findById,
  generateId,
  logger,
  readCollection,
  upsert,
  type JobStatus,
  type Project,
  type ShowPackage,
} from '../../shared/index';
import { AIOrchestrator, aiOrchestrator } from '../ai/index';
import { ScriptAdapter, scriptAdapter } from './ScriptAdapter';

const JOBS_COLLECTION = 'show-factory-jobs';
const PACKAGES_COLLECTION = 'show-packages';

interface ComponentSpec {
  filename: string;
  prompt: string;
}

export class ShowFactoryNotFoundError extends Error {
  constructor(id: string) {
    super(`Show package not found: ${id}`);
    this.name = 'ShowFactoryNotFoundError';
  }
}

export class ShowFactoryJobNotFoundError extends Error {
  constructor(id: string) {
    super(`Show factory job not found: ${id}`);
    this.name = 'ShowFactoryJobNotFoundError';
  }
}

export class ShowFactoryService {
  constructor(
    private readonly ai: AIOrchestrator = aiOrchestrator,
    private readonly adapter: ScriptAdapter = scriptAdapter,
  ) {}

  private packagesRoot(): string {
    return path.join(config.dataDir, 'show-packages');
  }

  private packageDir(id: string): string {
    return path.join(this.packagesRoot(), id);
  }

  async ensurePackagesDir(): Promise<void> {
    await fs.mkdir(this.packagesRoot(), { recursive: true });
  }

  async listShowPackages(projectId: string): Promise<ShowPackage[]> {
    const packages = await readCollection<ShowPackage>(PACKAGES_COLLECTION);
    return packages
      .filter((pkg) => pkg.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getShowPackage(id: string): Promise<ShowPackage> {
    const pkg = await findById<ShowPackage>(PACKAGES_COLLECTION, id);
    if (!pkg) {
      throw new ShowFactoryNotFoundError(id);
    }
    return pkg;
  }

  async deleteShowPackage(id: string): Promise<void> {
    const pkg = await this.getShowPackage(id);
    await deleteById(PACKAGES_COLLECTION, id);
    await fs.rm(this.packageDir(id), { recursive: true, force: true });
    logger.info(`Deleted show package: ${pkg.title} (${id})`);
  }

  async generateShowPackage(
    projectId: string,
    type: ShowPackage['type'],
  ): Promise<{ jobId: string; packageId: string }> {
    const project = await findById<Project>('projects', projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    await this.ensurePackagesDir();

    const packageId = generateId();
    const jobId = generateId();
    const now = new Date().toISOString();

    const pkg: ShowPackage = {
      id: packageId,
      projectId,
      title: `${project.title} — ${this.formatTypeLabel(type)}`,
      type,
      components: [],
      status: 'generating',
      createdAt: now,
    };

    const job: JobStatus = {
      id: jobId,
      type: `show-factory:${type}`,
      status: 'queued',
      progress: 0,
      result: { packageId },
      createdAt: now,
      updatedAt: now,
    };

    await upsert(PACKAGES_COLLECTION, pkg);
    await upsert(JOBS_COLLECTION, job);
    await fs.mkdir(this.packageDir(packageId), { recursive: true });

    emitEvent('job:queued', job);
    void this.runGeneration(jobId, packageId, project, type);

    return { jobId, packageId };
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    const job = await findById<JobStatus>(JOBS_COLLECTION, jobId);
    if (!job) {
      throw new ShowFactoryJobNotFoundError(jobId);
    }
    return job;
  }

  async exportShowPackage(id: string, format: 'zip' | 'pdf'): Promise<string> {
    const pkg = await this.getShowPackage(id);
    const dir = this.packageDir(id);

    if (format === 'zip') {
      return this.exportZip(pkg, dir);
    }

    return this.exportPdf(pkg, dir);
  }

  private async runGeneration(
    jobId: string,
    packageId: string,
    project: Project,
    type: ShowPackage['type'],
  ): Promise<void> {
    try {
      await this.updateJob(jobId, { status: 'running', progress: 5 });

      const specs = this.componentSpecs(type, project.title);
      const components: string[] = [];
      const total = specs.length;

      for (let index = 0; index < specs.length; index += 1) {
        const spec = specs[index];
        const response = await this.ai.generateWithContext(
          {
            prompt: spec.prompt,
            projectId: project.id,
            temperature: 0.7,
            maxTokens: 4096,
          },
          project.id,
        );

        const filePath = path.join(this.packageDir(packageId), spec.filename);
        await fs.writeFile(filePath, `${response.text.trim()}\n`, 'utf-8');
        components.push(spec.filename);

        const progress = Math.round(((index + 1) / total) * 90) + 5;
        await this.updateJob(jobId, { progress });
      }

      if (type === 'theatre' || type === 'radio') {
        const chapters = await readCollection<{ id: string; projectId: string; order: number }>(
          'chapters',
        );
        const firstChapter = chapters
          .filter((chapter) => chapter.projectId === project.id)
          .sort((a, b) => a.order - b.order)[0];

        if (firstChapter) {
          const script = await this.adapter.adaptChapterToScript(
            firstChapter.id,
            type === 'theatre' ? 'theatre' : 'radio',
          );
          const scriptFile = type === 'theatre' ? 'adapted-script.md' : 'radio-script.md';
          await fs.writeFile(
            path.join(this.packageDir(packageId), scriptFile),
            `${script}\n`,
            'utf-8',
          );
          components.unshift(scriptFile);
        }
      }

      const manifestPath = path.join(this.packageDir(packageId), 'manifest.json');
      await fs.writeFile(
        manifestPath,
        JSON.stringify(
          {
            id: packageId,
            projectId: project.id,
            title: `${project.title} — ${this.formatTypeLabel(type)}`,
            type,
            components,
            generatedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        'utf-8',
      );

      const pkg = await this.getShowPackage(packageId);
      await upsert(PACKAGES_COLLECTION, {
        ...pkg,
        components,
        status: 'ready',
      });

      await this.updateJob(jobId, {
        status: 'complete',
        progress: 100,
        result: { packageId, components },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Show package generation failed (${packageId}): ${message}`);

      const pkg = await findById<ShowPackage>(PACKAGES_COLLECTION, packageId);
      if (pkg) {
        await upsert(PACKAGES_COLLECTION, { ...pkg, status: 'generating' });
      }

      await this.updateJob(jobId, {
        status: 'failed',
        error: message,
      });
    }
  }

  private async updateJob(
    jobId: string,
    patch: Partial<Pick<JobStatus, 'status' | 'progress' | 'result' | 'error'>>,
  ): Promise<void> {
    const job = await this.getJobStatus(jobId);
    const updated: JobStatus = {
      ...job,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    await upsert(JOBS_COLLECTION, updated);

    if (updated.status === 'complete') {
      emitEvent('job:complete', updated);
    } else if (updated.status === 'failed') {
      emitEvent('job:failed', updated);
    } else {
      emitEvent('job:progress', updated);
    }
  }

  private componentSpecs(type: ShowPackage['type'], title: string): ComponentSpec[] {
    switch (type) {
      case 'theatre':
        return [
          {
            filename: 'scene-breakdown.md',
            prompt: `Create a detailed scene breakdown for the theatre adaptation of "${title}". List each scene with location, characters present, mood, and a one-line summary.`,
          },
          {
            filename: 'character-voice-guide.md',
            prompt: `Write a character voice guide for "${title}". For each major character, describe vocal quality, speech patterns, accent notes, and emotional range.`,
          },
          {
            filename: 'stage-direction-notes.md',
            prompt: `Write stage direction notes for "${title}". Cover blocking suggestions, key physical beats, and transitions between scenes.`,
          },
          {
            filename: 'lighting-sound-cues.md',
            prompt: `Create a lighting and sound cue list for "${title}". Number each cue with scene reference, description, and timing notes.`,
          },
          {
            filename: 'programme-notes.md',
            prompt: `Write programme notes for "${title}" including a director's note, character bios, and a short synopsis suitable for a theatre programme.`,
          },
        ];
      case 'radio':
        return [
          {
            filename: 'narrator-introduction.md',
            prompt: `Write a narrator introduction script for the radio adaptation of "${title}". Set tone, context, and hook the listener in under 90 seconds.`,
          },
          {
            filename: 'cast-list.md',
            prompt: `Create a cast list with voice direction notes for "${title}". Include each role, casting notes, and vocal direction.`,
          },
          {
            filename: 'production-notes.md',
            prompt: `Write production notes for the radio drama "${title}". Cover studio setup, pacing, music beds, and recording priorities.`,
          },
        ];
      case 'podcast':
        return [
          {
            filename: 'episode-breakdown.md',
            prompt: `Create an episode breakdown for a podcast based on "${title}". Include intro, segment list with timings, and outro.`,
          },
          {
            filename: 'host-script.md',
            prompt: `Write a host script and talking points for a podcast episode about "${title}".`,
          },
          {
            filename: 'interview-questions.md',
            prompt: `Write interview questions applicable to a podcast episode inspired by "${title}". Group by theme.`,
          },
          {
            filename: 'show-notes.md',
            prompt: `Write show notes and episode description copy for a podcast based on "${title}".`,
          },
          {
            filename: 'chapter-timestamps.md',
            prompt: `Create chapter timestamps for a podcast episode about "${title}". Use mm:ss format with segment titles.`,
          },
        ];
      case 'live-reading':
        return [
          {
            filename: 'curated-excerpts.md',
            prompt: `Select and format curated reading excerpts from "${title}" suitable for a live author reading event.`,
          },
          {
            filename: 'reader-introduction.md',
            prompt: `Write a reader introduction script for a live reading of "${title}". Welcome the audience and frame the excerpts.`,
          },
          {
            filename: 'audience-qa-prompts.md',
            prompt: `Create audience Q&A prompts and facilitator notes for a live reading event of "${title}".`,
          },
          {
            filename: 'event-programme.md',
            prompt: `Write an event programme for a live reading of "${title}" including schedule, bios, and housekeeping notes.`,
          },
        ];
    }
  }

  private formatTypeLabel(type: ShowPackage['type']): string {
    switch (type) {
      case 'theatre':
        return 'Theatre Pack';
      case 'radio':
        return 'Radio Drama';
      case 'podcast':
        return 'Podcast Pack';
      case 'live-reading':
        return 'Live Reading';
    }
  }

  private async exportZip(pkg: ShowPackage, dir: string): Promise<string> {
    await this.ensurePackagesDir();
    const exportPath = path.join(this.packagesRoot(), `${pkg.id}.zip`);

    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(exportPath);
      const archive = new ZipArchive({ zlib: { level: 9 } });

      output.on('close', () => resolve());
      output.on('error', reject);
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(dir, false);
      void archive.finalize();
    });

    await upsert(PACKAGES_COLLECTION, { ...pkg, status: 'exported' });
    logger.info(`Exported show package zip: ${exportPath}`);
    return exportPath;
  }

  private async exportPdf(pkg: ShowPackage, dir: string): Promise<string> {
    const exportPath = path.join(this.packagesRoot(), `${pkg.id}.pdf`);
    const sections: string[] = [
      pkg.title,
      `Type: ${this.formatTypeLabel(pkg.type)}`,
      `Generated: ${pkg.createdAt}`,
      '',
    ];

    for (const filename of pkg.components) {
      const content = await fs.readFile(path.join(dir, filename), 'utf-8');
      sections.push(`--- ${filename} ---`);
      sections.push(content.trim());
      sections.push('');
    }

    await fs.writeFile(exportPath, this.buildSimplePdf(sections.join('\n')), 'binary');
    await upsert(PACKAGES_COLLECTION, { ...pkg, status: 'exported' });
    logger.info(`Exported show package pdf: ${exportPath}`);
    return exportPath;
  }

  private buildSimplePdf(text: string): Buffer {
    const escaped = text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.slice(0, 100))
      .join('\\n');

    const content = `BT /F1 11 Tf 50 750 Td (${escaped}) Tj ET`;
    const objects = [
      '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj',
      '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj',
      '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj',
      `4 0 obj<< /Length ${content.length} >>stream\n${content}\nendstream endobj`,
      '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj',
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];

    for (const object of objects) {
      offsets.push(Buffer.byteLength(pdf, 'utf-8'));
      pdf += `${object}\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'utf-8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';

    for (let index = 1; index <= objects.length; index += 1) {
      pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'utf-8');
  }
}

export const showFactoryService = new ShowFactoryService();
