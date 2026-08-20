import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { runAsUser } from '../services/requestContext';

export interface CaspaUser {
  id: string;
  email: string;
  name: string;
  groups: string[];
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function clean(value: unknown, max = 320): string {
  return String(value || '').trim().slice(0, max);
}

export function requireAuthenticatedUser(req: Request, res: Response, next: NextFunction): void {
  const expectedSecret = String(process.env.CASPA_PROXY_SHARED_SECRET || '');
  const suppliedSecret = clean(req.headers['x-caspa-proxy-secret'], 500);
  const id = clean(req.headers['x-authentik-uid'] || req.headers['x-caspa-user-id']);
  if (!expectedSecret || !suppliedSecret || !safeEqual(expectedSecret, suppliedSecret) || !id) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  const user = {
    id,
    email: clean(req.headers['x-authentik-email'] || req.headers['x-caspa-user-email']),
    name: clean(req.headers['x-authentik-name'] || req.headers['x-caspa-user-name']),
    groups: clean(req.headers['x-authentik-groups'], 2000).split('|').map((value) => value.trim()).filter(Boolean),
  } satisfies CaspaUser;
  res.locals.caspaUser = user;
  runAsUser(user, next);
}

export function requestUser(res: Response): CaspaUser {
  const user = res.locals.caspaUser as CaspaUser | undefined;
  if (!user) throw new Error('Authenticated user context is missing');
  return user;
}
