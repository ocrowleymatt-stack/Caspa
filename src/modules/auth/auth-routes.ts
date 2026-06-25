import { Router, type Request, type Response } from 'express';
import { asyncHandler, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { AuthError } from './errors';
import { AuthService } from './AuthService';
import { requireAdmin, requireAuth } from './authMiddleware';
import { UserService } from './UserService';

const authService = new AuthService();
const userService = new UserService();

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return header.slice(7).trim() || null;
}

function handleAuthError(res: Response, error: unknown): void {
  if (error instanceof AuthError) {
    sendError(res, error, error.statusCode);
    return;
  }
  sendError(res, error);
}

export const authRouter = Router();

authRouter.post(
  '/api/auth/register',
  asyncHandler(async (req, res) => {
    try {
      const { email, password, displayName } = req.body as {
        email?: string;
        password?: string;
        displayName?: string;
      };

      if (!email || !password || !displayName) {
        sendError(res, new Error('email, password, and displayName are required'), 400);
        return;
      }

      const user = await authService.register({ email, password, displayName });
      sendSuccess(res, user, 201);
    } catch (error) {
      handleAuthError(res, error);
    }
  }),
);

authRouter.post(
  '/api/auth/login',
  asyncHandler(async (req, res) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        sendError(res, new Error('email and password are required'), 400);
        return;
      }

      const result = await authService.login(email, password);
      sendSuccess(res, result);
    } catch (error) {
      handleAuthError(res, error);
    }
  }),
);

authRouter.post(
  '/api/auth/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const token = extractBearerToken(req);
    if (token) {
      await authService.logout(token);
    }
    sendSuccess(res, { loggedOut: true });
  }),
);

authRouter.get(
  '/api/auth/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    sendSuccess(res, req.user);
  }),
);

authRouter.get(
  '/api/auth/users',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const users = await userService.listAll();
    sendSuccess(res, users);
  }),
);

authRouter.get(
  '/api/auth/users/pending',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const users = await userService.listPending();
    sendSuccess(res, users);
  }),
);

authRouter.post(
  '/api/auth/users/:id/approve',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await userService.approve(param(req, 'id'), req.user!.id);
    sendSuccess(res, user);
  }),
);

authRouter.post(
  '/api/auth/users/:id/reject',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await userService.reject(param(req, 'id'), req.user!.id);
    sendSuccess(res, user);
  }),
);

authRouter.post(
  '/api/auth/users/:id/disable',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await userService.disable(param(req, 'id'));
    sendSuccess(res, user);
  }),
);

authRouter.post(
  '/api/auth/users/:id/promote',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await userService.promote(param(req, 'id'));
    sendSuccess(res, user);
  }),
);

export async function bootstrapAuth(): Promise<void> {
  await userService.bootstrapIfEmpty();
  await userService.migrateOrphanProjects();
  await authService.cleanupExpiredSessions();
}
