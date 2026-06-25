import type { Project } from '../../shared';
import { ForbiddenError } from './errors';
import type { UserPublic } from './types';

export function canAccessProject(project: Project, user: UserPublic): boolean {
  if (user.role === 'admin') {
    return true;
  }
  return project.ownerId === user.id;
}

export function assertProjectAccess(project: Project, user: UserPublic): void {
  if (!canAccessProject(project, user)) {
    throw new ForbiddenError('You do not have access to this project');
  }
}

export function filterProjectsForUser(projects: Project[], user: UserPublic): Project[] {
  if (user.role === 'admin') {
    return projects;
  }
  return projects.filter((project) => project.ownerId === user.id);
}
