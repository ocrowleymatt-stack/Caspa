import type { UserPublic } from '../modules/auth/types';

declare global {
  namespace Express {
    interface Request {
      user?: UserPublic;
    }
  }
}

export {};
