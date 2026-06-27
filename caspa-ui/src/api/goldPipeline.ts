import { apiPostStream } from './client';
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

export function executeGoldPipelineStream(
  body: GoldPipelineExecuteBody,
  onEvent: (event: GoldPipelineStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return apiPostStream<GoldPipelineStreamEvent>(
    '/api/goldpipeline/execute',
    body,
    onEvent,
    signal,
  );
}
