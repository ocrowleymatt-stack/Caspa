import bcrypt from 'bcrypt';
import {
  deleteById,
  findById,
  generateId,
  logger,
  readCollection,
  upsert,
  writeCollection,
  type Project,
} from '../../shared';
import { getConfig } from '../../shared/config';
import type { User, UserPublic, UserRole, UserStatus } from './types';

const USERS = 'users';
const PROJECTS = 'projects';

function toPublic(user: User): UserPublic {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    verifiedAt: user.verifiedAt,
  };
}

export class UserService {
  toPublic(user: User): UserPublic {
    return toPublic(user);
  }

  async listAll(): Promise<UserPublic[]> {
    const users = await readCollection<User>(USERS);
    return users.map(toPublic);
  }

  async listPending(): Promise<UserPublic[]> {
    const users = await readCollection<User>(USERS);
    return users.filter((user) => user.status === 'pending').map(toPublic);
  }

  async getById(id: string): Promise<User | null> {
    return findById<User>(USERS, id);
  }

  async getByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    const users = await readCollection<User>(USERS);
    return users.find((user) => user.email === normalized) ?? null;
  }

  async createUser(input: {
    email: string;
    password: string;
    displayName: string;
    role?: UserRole;
    status?: UserStatus;
  }): Promise<User> {
    const email = input.email.trim().toLowerCase();
    if (!email || !input.password || !input.displayName.trim()) {
      throw new Error('Email, password, and display name are required');
    }

    const existing = await this.getByEmail(email);
    if (existing) {
      throw new Error('An account with this email already exists');
    }

    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user: User = {
      id: generateId(),
      email,
      passwordHash,
      displayName: input.displayName.trim(),
      role: input.role ?? 'user',
      status: input.status ?? 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await upsert(USERS, user);
    logger.info(`Created user: ${user.email} (${user.status})`);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`User not found: ${id}`);
    }

    const user: User = {
      ...existing,
      ...updates,
      id: existing.id,
      email: existing.email,
      passwordHash: existing.passwordHash,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await upsert(USERS, user);
    return user;
  }

  async approve(id: string, adminId: string): Promise<UserPublic> {
    const user = await this.updateUser(id, {
      status: 'active',
      verifiedAt: new Date().toISOString(),
      verifiedBy: adminId,
    });
    logger.info(`Approved user: ${user.email}`);
    return toPublic(user);
  }

  async reject(id: string, adminId: string): Promise<UserPublic> {
    const user = await this.updateUser(id, {
      status: 'rejected',
      verifiedAt: new Date().toISOString(),
      verifiedBy: adminId,
    });
    logger.info(`Rejected user: ${user.email}`);
    return toPublic(user);
  }

  async disable(id: string): Promise<UserPublic> {
    const user = await this.updateUser(id, { status: 'disabled' });
    logger.info(`Disabled user: ${user.email}`);
    return toPublic(user);
  }

  async promote(id: string): Promise<UserPublic> {
    const user = await this.updateUser(id, { role: 'admin' });
    logger.info(`Promoted user to admin: ${user.email}`);
    return toPublic(user);
  }

  async bootstrapIfEmpty(): Promise<User | null> {
    const users = await readCollection<User>(USERS);
    if (users.length > 0) {
      return null;
    }

    const { adminEmail, adminPassword } = getConfig();
    if (!adminEmail || !adminPassword) {
      logger.warn(
        'No users exist and ADMIN_EMAIL/ADMIN_PASSWORD are not set — registration is open for first user only',
      );
      return null;
    }

    const admin = await this.createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: 'Administrator',
      role: 'admin',
      status: 'active',
    });

    logger.info(`Bootstrap admin created: ${admin.email}`);
    return admin;
  }

  async migrateOrphanProjects(): Promise<number> {
    const projects = await readCollection<Project>(PROJECTS);
    const orphanProjects = projects.filter((project) => !project.ownerId);
    if (orphanProjects.length === 0) {
      return 0;
    }

    const users = await readCollection<User>(USERS);
    const admin = users.find((user) => user.role === 'admin' && user.status === 'active');
    if (!admin) {
      logger.warn(`${orphanProjects.length} projects have no ownerId and no active admin to assign them to`);
      return 0;
    }

    const updated = projects.map((project) =>
      project.ownerId ? project : { ...project, ownerId: admin.id },
    );
    await writeCollection(PROJECTS, updated);
    logger.info(`Assigned ${orphanProjects.length} orphan project(s) to admin ${admin.email}`);
    return orphanProjects.length;
  }

  async deleteUser(id: string): Promise<boolean> {
    return deleteById(USERS, id);
  }
}
