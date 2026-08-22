import { AsyncLocalStorage } from 'node:async_hooks';
import type { CaspaUser } from '../middleware/authenticatedUser';

const userContext = new AsyncLocalStorage<CaspaUser>();
const projectContext = new AsyncLocalStorage<string>();

export function runAsUser<T>(user: CaspaUser, callback: () => T): T {
  return userContext.run(user, callback);
}

export function currentUser(): CaspaUser | undefined {
  return userContext.getStore();
}

export function runAsProject<T>(projectId: string | undefined, callback: () => T): T {
  const id = String(projectId || '').trim();
  return id ? projectContext.run(id, callback) : callback();
}

export function currentProjectId(): string | undefined {
  return projectContext.getStore();
}

export function projectIdFromRequest(req: { body?: any; query?: any; headers?: any }): string | undefined {
  const raw = req.body?.projectId
    || req.body?.project?.id
    || req.body?.brief?.projectId
    || req.query?.projectId
    || req.headers?.['x-caspa-project-id'];
  const id = String(Array.isArray(raw) ? raw[0] : raw || '').trim();
  return id || undefined;
}
