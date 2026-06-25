import { Router, type Request, type Response } from 'express';
import { ForbiddenError, AuthError } from '../modules/auth/errors';
import { NotFoundError } from '../modules/manuscript';

export type ApiResponse = {
  success: boolean;
  data?: unknown;
  error?: string;
};

export function sendSuccess(res: Response, data: unknown, status = 200): void {
  const body: ApiResponse = { success: true, data };
  res.status(status).json(body);
}

export function sendError(res: Response, error: unknown, status = 500): void {
  const message = error instanceof Error ? error.message : 'Unknown error';
  let code = status;
  if (error instanceof NotFoundError) {
    code = 404;
  } else if (error instanceof ForbiddenError) {
    code = 403;
  } else if (error instanceof AuthError) {
    code = error.statusCode;
  }
  const body: ApiResponse = { success: false, error: message };
  res.status(code).json(body);
}

export function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response) => void {
  return (req, res) => {
    handler(req, res).catch((error) => sendError(res, error));
  };
}

export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

export function createElevationRouter(): Router {
  return Router();
}
