export { authRouter, bootstrapAuth } from './auth-routes';
export { requireAuth, requireAdmin, attachUser } from './authMiddleware';
export { AuthService } from './AuthService';
export { UserService } from './UserService';
export { assertProjectAccess, canAccessProject, filterProjectsForUser } from './projectAccess';
export type { User, UserPublic, UserRole, UserStatus, Session } from './types';
