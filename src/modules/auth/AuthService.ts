import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { deleteById, findById, generateId, logger, readCollection, upsert } from '../../shared';
import { getConfig } from '../../shared/config';
import { AuthError } from './errors';
import type { AuthTokenPayload, Session, User, UserPublic } from './types';
import { UserService } from './UserService';

const SESSIONS = 'sessions';

export class AuthService {
  private userService = new UserService();

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }

  private signToken(session: Session): string {
    const { authSecret } = getConfig();
    const payload: AuthTokenPayload = {
      sid: session.id,
      sub: session.userId,
      exp: Math.floor(new Date(session.expiresAt).getTime() / 1000),
    };
    return jwt.sign(payload, authSecret, { algorithm: 'HS256' });
  }

  private async createSession(userId: string): Promise<{ token: string; session: Session }> {
    const { jwtExpiresIn } = getConfig();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + jwtExpiresIn * 1000);
    const session: Session = {
      id: generateId(),
      userId,
      token: generateId(),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await upsert(SESSIONS, session);
    const token = this.signToken(session);
    return { token, session };
  }

  async register(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<UserPublic> {
    const user = await this.userService.createUser({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      role: 'user',
      status: 'pending',
    });
    return this.userService.toPublic(user);
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; user: UserPublic }> {
    const user = await this.userService.getByEmail(email);
    if (!user) {
      throw new AuthError('Invalid email or password');
    }

    const valid = await this.verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new AuthError('Invalid email or password');
    }

    if (user.status === 'pending') {
      throw new AuthError('Account pending admin approval');
    }
    if (user.status === 'rejected') {
      throw new AuthError('Account registration was rejected');
    }
    if (user.status === 'disabled') {
      throw new AuthError('Account is disabled');
    }

    const { token } = await this.createSession(user.id);
    logger.info(`User logged in: ${user.email}`);
    return { token, user: this.userService.toPublic(user) };
  }

  async logout(token: string): Promise<void> {
    const sessionId = this.extractSessionId(token);
    if (!sessionId) {
      return;
    }
    await deleteById(SESSIONS, sessionId);
  }

  private extractSessionId(token: string): string | null {
    try {
      const { authSecret } = getConfig();
      const payload = jwt.verify(token, authSecret) as AuthTokenPayload;
      return payload.sid ?? null;
    } catch {
      return null;
    }
  }

  async validateSession(token: string): Promise<{ user: UserPublic; session: Session } | null> {
    try {
      const { authSecret } = getConfig();
      const payload = jwt.verify(token, authSecret) as AuthTokenPayload;
      const session = await findById<Session>(SESSIONS, payload.sid);
      if (!session) {
        return null;
      }

      if (new Date(session.expiresAt).getTime() < Date.now()) {
        await deleteById(SESSIONS, session.id);
        return null;
      }

      const user = await this.userService.getById(session.userId);
      if (!user || user.status !== 'active') {
        return null;
      }

      return { user: this.userService.toPublic(user), session };
    } catch {
      return null;
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    const sessions = await readCollection<Session>(SESSIONS);
    const now = Date.now();
    const active = sessions.filter((session) => new Date(session.expiresAt).getTime() >= now);
    const removed = sessions.length - active.length;
    if (removed > 0) {
      const { writeCollection } = await import('../../shared/db');
      await writeCollection(SESSIONS, active);
    }
    return removed;
  }
}
