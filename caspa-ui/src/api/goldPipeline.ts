import { apiCall } from './client';
import { getGoldReport } from './gold';
import {
  getCaspaJob,
  isJobStartResponse,
  waitForCaspaJob,
  type JobProgress,
  type JobStartResponse,
} from './caspaJobs';
import type { GoldRunOptions } from './gold';
import type { GoldReport } from '../types';

export type GoldPipelineStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface GoldPipelineExecuteBody {
  projectId: string;
  config: GoldRunOptions;
  chapters: string[];
  sourceLockId: string;
}

export type GoldPipelineStreamEvent =
  | {
      type: 'step_update';
      run_id: string;
      stage: string;
      status: GoldPipelineStepStatus;
      message: string;
      progress: number;
      current_chapter?: string;
      warnings?: string[];
    }
  | {
      type: 'complete';
      run_id: string;
      report: GoldReport;
    }
  | {
      type: 'error';
      message: string;
    };

export function isGoldPipelineStreamEvent(value: unknown): value is GoldPipelineStreamEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as { type?: string };
  return event.type === 'step_update' || event.type === 'complete' || event.type === 'error';
}

function emitStageEvents(
  progress: JobProgress,
  runId: string,
  scopeLabel: string,
  seen: Set<string>,
  onEvent: (event: GoldPipelineStreamEvent) => void,
) {
  for (const stage of progress.stages ?? []) {
    if (stage.status !== 'running' && stage.status !== 'completed') continue;
    const key = `${stage.id}:${stage.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    onEvent({
      type: 'step_update',
      run_id: runId,
      stage: stage.id,
      status: stage.status === 'completed' ? 'done' : 'running',
      message: stage.status === 'completed' ? `${stage.label} complete.` : stage.label,
      progress: progress.progress,
      current_chapter: scopeLabel,
    });
  }
}

export async function executeGoldPipelineJob(
  body: GoldPipelineExecuteBody,
  onEvent: (event: GoldPipelineStreamEvent) => void,
  options?: { scopeLabel?: string; signal?: AbortSignal },
): Promise<void> {
  const scopeLabel = options?.scopeLabel ?? 'Whole project';
  const start = await apiCall<JobStartResponse | Record<string, unknown>>('/api/goldpipeline/execute', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!isJobStartResponse(start)) {
    const report = await getGoldReport(body.projectId);
    if (report) {
      onEvent({ type: 'complete', run_id: report.id, report });
      return;
    }
    throw new Error('Gold pipeline returned an unexpected response.');
  }

  const runId = start.jobId;
  const seen = new Set<string>();

  await waitForCaspaJob(start.jobId, {
    pollMs: 1500,
    onProgress: (progress) => {
      if (options?.signal?.aborted) return;
      emitStageEvents(progress, runId, scopeLabel, seen, onEvent);
    },
  });

  if (options?.signal?.aborted) {
    throw new Error('aborted');
  }

  const job = await getCaspaJob(start.jobId);
  const report = await getGoldReport(body.projectId);
  if (!report) {
    throw new Error('Gold pipeline completed but no report was found.');
  }

  onEvent({ type: 'complete', run_id: runId, report });
  void job;
}

/** @deprecated Use executeGoldPipelineJob — SSE route now returns 202 + jobId. */
export function executeGoldPipelineStream(
  body: GoldPipelineExecuteBody,
  onEvent: (event: GoldPipelineStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return executeGoldPipelineJob(body, onEvent, { signal });
}
