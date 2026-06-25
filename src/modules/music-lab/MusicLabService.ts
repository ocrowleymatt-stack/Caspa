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
  type Character,
  type Chapter,
  type JobStatus,
  type MusicCompositionBrief,
  type MusicTrack,
  type Project,
} from '../../shared';
import { aiOrchestrator } from '../ai';

const TRACKS = 'music-tracks';

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export interface CreateTrackParams {
  projectId?: string;
  genre: string;
  mood: string;
  tempo: number;
  duration: number;
  description?: string;
  title?: string;
}

interface ParsedBrief {
  title: string;
  instruments: string[];
  structure: string;
  feel: string;
  tempo: number;
  key: string;
  lyricsConcept?: string;
  productionNotes: string;
  sunoPrompt: string;
  musicXmlSkeleton: string;
  genre?: string;
}

const batchJobs = new Map<string, JobStatus>();

async function briefsDir(): Promise<string> {
  const dir = path.join(getConfig().dataDir, 'music-briefs');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function briefPath(trackId: string): Promise<string> {
  return path.join(await briefsDir(), `${trackId}.json`);
}

export async function readBrief(trackId: string): Promise<MusicCompositionBrief | null> {
  try {
    const content = await fs.readFile(await briefPath(trackId), 'utf-8');
    return JSON.parse(content) as MusicCompositionBrief;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeBrief(brief: MusicCompositionBrief): Promise<void> {
  await fs.writeFile(await briefPath(brief.trackId), JSON.stringify(brief, null, 2), 'utf-8');
}

async function deleteBrief(trackId: string): Promise<void> {
  try {
    await fs.unlink(await briefPath(trackId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

function parseBriefFromAI(text: string, fallback: Partial<ParsedBrief>): ParsedBrief {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<ParsedBrief>;
      return {
        title: parsed.title ?? fallback.title ?? 'Untitled Track',
        instruments: Array.isArray(parsed.instruments) ? parsed.instruments : ['piano'],
        structure: parsed.structure ?? 'Intro - Verse - Chorus - Outro',
        feel: parsed.feel ?? fallback.feel ?? 'atmospheric',
        tempo: typeof parsed.tempo === 'number' ? parsed.tempo : (fallback.tempo ?? 90),
        key: parsed.key ?? 'C minor',
        lyricsConcept: parsed.lyricsConcept,
        productionNotes: parsed.productionNotes ?? text.slice(0, 500),
        sunoPrompt: parsed.sunoPrompt ?? fallback.sunoPrompt ?? `${fallback.feel ?? 'ambient'} instrumental`,
        musicXmlSkeleton: parsed.musicXmlSkeleton ?? 'Single-staff melody with chord symbols',
      };
    } catch {
      // fall through to defaults
    }
  }

  return {
    title: fallback.title ?? 'Untitled Track',
    instruments: ['piano', 'strings'],
    structure: 'Intro - Verse - Chorus - Outro',
    feel: fallback.feel ?? 'atmospheric',
    tempo: fallback.tempo ?? 90,
    key: 'C minor',
    productionNotes: text.slice(0, 1000),
    sunoPrompt: fallback.sunoPrompt ?? `${fallback.feel ?? 'ambient'} ${fallback.genre ?? 'instrumental'}`,
    musicXmlSkeleton: 'Single-staff melody with chord symbols',
  };
}

export class MusicLabService {
  async createTrack(params: CreateTrackParams): Promise<MusicTrack> {
    const id = generateId();
    const title = params.title ?? `${params.mood} ${params.genre}`.replace(/\b\w/g, (c) => c.toUpperCase());

    const briefData = await this.generateBriefFromPrompt(
      `Create a composition brief for a ${params.duration}-second ${params.genre} track.
Mood: ${params.mood}. Tempo: ${params.tempo} BPM.
${params.description ? `Description: ${params.description}` : ''}

Return JSON with keys: title, instruments (array), structure, feel, tempo, key, lyricsConcept (optional), productionNotes, sunoPrompt (Suno/Udio-ready prompt under 200 chars), musicXmlSkeleton.`,
      {
        title,
        feel: params.mood,
        tempo: params.tempo,
        genre: params.genre,
        sunoPrompt: `${params.mood} ${params.genre}, ${params.tempo} BPM, instrumental`,
      },
    );

    const track: MusicTrack = {
      id,
      projectId: params.projectId,
      title: briefData.title,
      genre: params.genre,
      mood: params.mood,
      tempo: briefData.tempo,
      duration: params.duration,
      sunoPrompt: briefData.sunoPrompt,
      generatedAt: new Date().toISOString(),
    };

    await upsert(TRACKS, track);
    await writeBrief({
      trackId: id,
      title: briefData.title,
      instruments: briefData.instruments,
      structure: briefData.structure,
      feel: briefData.feel,
      tempo: briefData.tempo,
      key: briefData.key,
      lyricsConcept: briefData.lyricsConcept,
      productionNotes: briefData.productionNotes,
      sunoPrompt: briefData.sunoPrompt,
      musicXmlSkeleton: briefData.musicXmlSkeleton,
      createdAt: track.generatedAt,
    });

    emitEvent('job:complete', {
      id,
      type: 'music-lab:track-created',
      status: 'complete',
      progress: 100,
      result: track,
      createdAt: track.generatedAt,
      updatedAt: track.generatedAt,
    });

    return track;
  }

  async listTracks(projectId?: string): Promise<MusicTrack[]> {
    const tracks = await readCollection<MusicTrack>(TRACKS);
    if (!projectId) {
      return tracks.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    }
    return tracks
      .filter((track) => track.projectId === projectId)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }

  async getTrack(id: string): Promise<MusicTrack> {
    const track = await findById<MusicTrack>(TRACKS, id);
    if (!track) {
      throw new NotFoundError(`Track not found: ${id}`);
    }
    return track;
  }

  async getTrackWithBrief(
    id: string,
  ): Promise<{ track: MusicTrack; brief: MusicCompositionBrief | null }> {
    const track = await this.getTrack(id);
    const brief = await readBrief(id);
    return { track, brief };
  }

  async deleteTrack(id: string): Promise<void> {
    await this.getTrack(id);
    await deleteById(TRACKS, id);
    await deleteBrief(id);
  }

  async generateOvernightBatch(projectId: string, count: number): Promise<string> {
    const jobId = generateId();
    const now = new Date().toISOString();
    const job: JobStatus = {
      id: jobId,
      type: 'music-lab:overnight-batch',
      status: 'queued',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };
    batchJobs.set(jobId, job);
    emitEvent('job:queued', job);

    void this.runBatchJob(jobId, projectId, count);
    return jobId;
  }

  private async runBatchJob(jobId: string, projectId: string, count: number): Promise<void> {
    const job = batchJobs.get(jobId);
    if (!job) {
      return;
    }

    job.status = 'running';
    job.updatedAt = new Date().toISOString();
    batchJobs.set(jobId, job);
    emitEvent('job:progress', { ...job });

    try {
      const { overnightScheduler } = await import('./OvernightScheduler');
      const tracks = await overnightScheduler.runBatch(projectId, count, (done, total) => {
        const current = batchJobs.get(jobId);
        if (!current) {
          return;
        }
        current.progress = Math.round((done / total) * 100);
        current.updatedAt = new Date().toISOString();
        batchJobs.set(jobId, current);
        emitEvent('job:progress', { ...current });
      });

      const completed: JobStatus = {
        ...job,
        status: 'complete',
        progress: 100,
        result: tracks,
        updatedAt: new Date().toISOString(),
      };
      batchJobs.set(jobId, completed);
      emitEvent('job:complete', completed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Overnight batch job ${jobId} failed: ${message}`);
      const failed: JobStatus = {
        ...job,
        status: 'failed',
        error: message,
        updatedAt: new Date().toISOString(),
      };
      batchJobs.set(jobId, failed);
      emitEvent('job:failed', failed);
    }
  }

  getJobStatus(jobId: string): JobStatus | null {
    return batchJobs.get(jobId) ?? null;
  }

  async generateChapterTheme(chapterId: string): Promise<MusicTrack> {
    const chapter = await findById<Chapter>('chapters', chapterId);
    if (!chapter) {
      throw new NotFoundError(`Chapter not found: ${chapterId}`);
    }

    const project = await findById<Project>('projects', chapter.projectId);
    const projectTitle = project?.title ?? 'Unknown Project';
    const excerpt = chapter.content.slice(0, 2000);

    const briefData = await this.generateBriefFromPrompt(
      `Create a chapter theme music brief for "${chapter.title}" in the novel "${projectTitle}".
Chapter status: ${chapter.status}. Word count: ${chapter.wordCount}.

Chapter excerpt:
${excerpt}

The music should capture the emotional arc and setting of this chapter.
Return JSON with keys: title, instruments (array), structure, feel, tempo, key, lyricsConcept (optional), productionNotes, sunoPrompt (Suno/Udio-ready prompt under 200 chars), musicXmlSkeleton.`,
      {
        title: `${chapter.title} Theme`,
        feel: 'cinematic',
        tempo: 80,
        sunoPrompt: `cinematic theme for "${chapter.title}", emotional, orchestral`,
      },
      chapter.projectId,
    );

    return this.saveGeneratedTrack({
      projectId: chapter.projectId,
      title: briefData.title,
      genre: project?.genre ?? 'cinematic',
      mood: briefData.feel,
      tempo: briefData.tempo,
      duration: 180,
      briefData,
    });
  }

  async generateCharacterLeitmotif(characterId: string): Promise<MusicTrack> {
    const character = await findById<Character>('characters', characterId);
    if (!character) {
      throw new NotFoundError(`Character not found: ${characterId}`);
    }

    const traits = character.traits.join(', ');
    const briefData = await this.generateBriefFromPrompt(
      `Create a character leitmotif for ${character.name} (${character.role}).
Description: ${character.description}
Backstory: ${character.backstory}
Traits: ${traits}

Design a recurring musical theme that reflects their personality and arc.
Return JSON with keys: title, instruments (array), structure, feel, tempo, key, lyricsConcept (optional), productionNotes, sunoPrompt (Suno/Udio-ready prompt under 200 chars), musicXmlSkeleton.`,
      {
        title: `${character.name} Leitmotif`,
        feel: 'character theme',
        tempo: 72,
        sunoPrompt: `leitmotif for ${character.name}, ${traits}, memorable melody`,
      },
      character.projectId,
    );

    return this.saveGeneratedTrack({
      projectId: character.projectId,
      title: briefData.title,
      genre: 'leitmotif',
      mood: briefData.feel,
      tempo: briefData.tempo,
      duration: 120,
      briefData,
    });
  }

  async generateAtmosphericPack(projectId: string): Promise<MusicTrack[]> {
    const chapters = (await readCollection<Chapter>('chapters'))
      .filter((chapter) => chapter.projectId === projectId)
      .sort((a, b) => a.order - b.order);

    if (chapters.length === 0) {
      throw new NotFoundError(`No chapters found for project: ${projectId}`);
    }

    const project = await findById<Project>('projects', projectId);
    const tracks: MusicTrack[] = [];

    for (const chapter of chapters) {
      const excerpt = chapter.content.slice(0, 1500);
      const briefData = await this.generateBriefFromPrompt(
        `Create an atmospheric background track for chapter "${chapter.title}" in "${project?.title ?? 'the novel'}".
Genre: ${project?.genre ?? 'fiction'}. Chapter order: ${chapter.order + 1}.

Excerpt:
${excerpt}

This is part of an atmospheric pack — one ambient track per chapter.
Return JSON with keys: title, instruments (array), structure, feel, tempo, key, lyricsConcept (optional), productionNotes, sunoPrompt (Suno/Udio-ready prompt under 200 chars), musicXmlSkeleton.`,
        {
          title: `${chapter.title} Atmosphere`,
          feel: 'ambient',
          tempo: 60,
          sunoPrompt: `ambient atmosphere, ${chapter.title}, subtle, background`,
        },
        projectId,
      );

      const track = await this.saveGeneratedTrack({
        projectId,
        title: briefData.title,
        genre: project?.genre ?? 'ambient',
        mood: briefData.feel,
        tempo: briefData.tempo,
        duration: 240,
        briefData,
      });
      tracks.push(track);
    }

    return tracks;
  }

  private async saveGeneratedTrack(params: {
    projectId: string;
    title: string;
    genre: string;
    mood: string;
    tempo: number;
    duration: number;
    briefData: ParsedBrief;
  }): Promise<MusicTrack> {
    const id = generateId();
    const generatedAt = new Date().toISOString();

    const track: MusicTrack = {
      id,
      projectId: params.projectId,
      title: params.briefData.title || params.title,
      genre: params.genre,
      mood: params.mood,
      tempo: params.briefData.tempo,
      duration: params.duration,
      sunoPrompt: params.briefData.sunoPrompt,
      generatedAt,
    };

    await upsert(TRACKS, track);
    await writeBrief({
      trackId: id,
      title: track.title,
      instruments: params.briefData.instruments,
      structure: params.briefData.structure,
      feel: params.briefData.feel,
      tempo: params.briefData.tempo,
      key: params.briefData.key,
      lyricsConcept: params.briefData.lyricsConcept,
      productionNotes: params.briefData.productionNotes,
      sunoPrompt: params.briefData.sunoPrompt,
      musicXmlSkeleton: params.briefData.musicXmlSkeleton,
      createdAt: generatedAt,
    });

    return track;
  }

  private async generateBriefFromPrompt(
    prompt: string,
    fallback: Partial<ParsedBrief> & { genre?: string },
    projectId?: string,
  ): Promise<ParsedBrief> {
    const response = projectId
      ? await aiOrchestrator.generateWithContext({ prompt, temperature: 0.7 }, projectId)
      : await aiOrchestrator.generate({ prompt, temperature: 0.7 });

    return parseBriefFromAI(response.text, fallback);
  }
}

export const musicLabService = new MusicLabService();
