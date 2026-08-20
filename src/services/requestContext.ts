import { AsyncLocalStorage } from 'node:async_hooks';
import type { CaspaUser } from '../middleware/authenticatedUser';

const userContext = new AsyncLocalStorage<CaspaUser>();

export function runAsUser<T>(user: CaspaUser, callback: () => T): T {
  return userContext.run(user, callback);
}

export function currentUser(): CaspaUser | undefined {
  return userContext.getStore();
}
