export type UserRole = 'admin' | 'user';

export type UserStatus = 'pending' | 'active' | 'rejected' | 'disabled';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface UserPublic {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  verifiedAt?: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuthTokenPayload {
  sid: string;
  sub: string;
  exp: number;
}
