import type { NextFunction, Request, Response } from 'express';
import { config } from '../../shared/config';
import { AuthService } from './AuthService';

const authService = new AuthService();

const PUBLIC_API_ROUTES = new Set(['POST:/api/auth/register', 'POST:/api/auth/login']);

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return header.slice(7).trim() || null;
}

function extractToken(req: Request): string | null {
  const bearer = extractBearerToken(req);
  if (bearer) {
    return bearer;
  }

  const queryToken = req.query.token;
  if (typeof queryToken === 'string' && queryToken.trim()) {
    return queryToken.trim();
  }

  return null;
}

export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }

  const result = await authService.validateSession(token);
  if (result) {
    req.user = result.user;
  }
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!config.authEnabled) {
    next();
    return;
  }

  if (!req.path.startsWith('/api/')) {
    next();
    return;
  }

  const routeKey = `${req.method}:${req.path}`;
  if (PUBLIC_API_ROUTES.has(routeKey)) {
    next();
    return;
  }

  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const result = await authService.validateSession(token);
  if (!result) {
    res.status(401).json({ success: false, error: 'Invalid or expired session' });
    return;
  }

  req.user = result.user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }

  next();
}
