import { EventEmitter } from 'events';
import type {
  AIRequest,
  AIResponse,
  Chapter,
  ExportJob,
  JobStatus,
  Project,
} from './types';

export interface EventMap {
  'project:created': Project;
  'project:updated': Project;
  'project:deleted': { id: string };
  'chapter:created': Chapter;
  'chapter:updated': Chapter;
  'chapter:deleted': { id: string; projectId: string };
  'job:queued': JobStatus;
  'job:progress': JobStatus;
  'job:complete': JobStatus;
  'job:failed': JobStatus;
  'ai:request': AIRequest;
  'ai:response': AIResponse;
  'export:started': ExportJob;
  'export:complete': ExportJob;
  'backup:started': { path: string };
  'backup:complete': { path: string };
}

class TypedEventBus extends EventEmitter {
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): boolean {
    return super.emit(event, payload);
  }

  on<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void,
  ): this {
    return super.on(event, listener);
  }

  once<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void,
  ): this {
    return super.once(event, listener);
  }

  off<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void,
  ): this {
    return super.off(event, listener);
  }
}

export const eventBus = new TypedEventBus();

export function emitEvent<K extends keyof EventMap>(
  event: K,
  payload: EventMap[K],
): boolean {
  return eventBus.emit(event, payload);
}

export function onEvent<K extends keyof EventMap>(
  event: K,
  listener: (payload: EventMap[K]) => void,
): void {
  eventBus.on(event, listener);
}
