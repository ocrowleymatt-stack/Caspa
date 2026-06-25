import {
  emitEvent,
  findById,
  generateId,
  logger,
  type MusicTrack,
  type Project,
} from '../../shared';
import { musicLabService, NotFoundError } from './MusicLabService';

export interface OvernightSchedule {
  id: string;
  projectId: string;
  trackCount: number;
  startHour: number;
  active: boolean;
}

interface ScheduledTimer {
  schedule: OvernightSchedule;
  timeoutId: ReturnType<typeof setTimeout>;
}

const schedules = new Map<string, ScheduledTimer>();

function msUntilHour(startHour: number): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(startHour, 0, 0, 0);

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}

export class OvernightScheduler {
  async scheduleOvernightRun(
    projectId: string,
    config: { trackCount: number; startHour: number },
  ): Promise<string> {
    const project = await findById<Project>('projects', projectId);
    if (!project) {
      throw new NotFoundError(`Project not found: ${projectId}`);
    }

    const scheduleId = generateId();
    const schedule: OvernightSchedule = {
      id: scheduleId,
      projectId,
      trackCount: config.trackCount,
      startHour: config.startHour,
      active: true,
    };

    const delay = msUntilHour(config.startHour);
    logger.info(
      `Scheduled overnight music run ${scheduleId} for project ${projectId} in ${Math.round(delay / 60000)} minutes`,
    );

    const timeoutId = setTimeout(() => {
      void this.executeScheduledRun(scheduleId);
    }, delay);

    schedules.set(scheduleId, { schedule, timeoutId });
    return scheduleId;
  }

  async cancelSchedule(scheduleId: string): Promise<void> {
    const entry = schedules.get(scheduleId);
    if (!entry) {
      throw new NotFoundError(`Schedule not found: ${scheduleId}`);
    }

    clearTimeout(entry.timeoutId);
    entry.schedule.active = false;
    schedules.delete(scheduleId);
    logger.info(`Cancelled overnight schedule ${scheduleId}`);
  }

  listSchedules(): OvernightSchedule[] {
    return Array.from(schedules.values()).map((entry) => ({ ...entry.schedule }));
  }

  async runBatch(
    projectId: string,
    count: number,
    onProgress: (done: number, total: number) => void,
  ): Promise<MusicTrack[]> {
    const project = await findById<Project>('projects', projectId);
    if (!project) {
      throw new NotFoundError(`Project not found: ${projectId}`);
    }

    const tracks: MusicTrack[] = [];
    const moods = ['contemplative', 'tense', 'hopeful', 'melancholic', 'triumphant', 'mysterious'];

    for (let i = 0; i < count; i += 1) {
      const mood = moods[i % moods.length];
      const track = await musicLabService.createTrack({
        projectId,
        genre: project.genre || 'cinematic',
        mood,
        tempo: 60 + (i % 5) * 15,
        duration: 180,
        description: `Overnight batch track ${i + 1} of ${count} for "${project.title}"`,
        title: `${project.title} — ${mood} ${i + 1}`,
      });
      tracks.push(track);
      onProgress(i + 1, count);
      emitEvent('job:progress', {
        id: `batch-${projectId}`,
        type: 'music-lab:batch-item',
        status: 'running',
        progress: Math.round(((i + 1) / count) * 100),
        result: { done: i + 1, total: count, trackId: track.id },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return tracks;
  }

  private async executeScheduledRun(scheduleId: string): Promise<void> {
    const entry = schedules.get(scheduleId);
    if (!entry || !entry.schedule.active) {
      return;
    }

    const { projectId, trackCount } = entry.schedule;
    logger.info(`Starting scheduled overnight run ${scheduleId}`);

    try {
      await this.runBatch(projectId, trackCount, (done, total) => {
        logger.info(`Overnight schedule ${scheduleId}: ${done}/${total} tracks complete`);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Scheduled run ${scheduleId} failed: ${message}`);
    } finally {
      entry.schedule.active = false;
      schedules.delete(scheduleId);
    }
  }
}

export const overnightScheduler = new OvernightScheduler();
