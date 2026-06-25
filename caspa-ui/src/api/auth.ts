import { apiCall } from './client';

export type UserRole = 'admin' | 'user';
export type UserStatus = 'pending' | 'active' | 'rejected' | 'disabled';

export interface UserPublic {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  verifiedAt?: string;
}

export interface LoginResponse {
  token: string;
  user: UserPublic;
}

export async function register(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<UserPublic> {
  return apiCall<UserPublic>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiCall<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  await apiCall<{ loggedOut: boolean }>('/api/auth/logout', { method: 'POST' });
}

export async function getMe(): Promise<UserPublic> {
  return apiCall<UserPublic>('/api/auth/me');
}

export async function listAllUsers(): Promise<UserPublic[]> {
  return apiCall<UserPublic[]>('/api/auth/users');
}

export async function listPendingUsers(): Promise<UserPublic[]> {
  return apiCall<UserPublic[]>('/api/auth/users/pending');
}

export async function approveUser(id: string): Promise<UserPublic> {
  return apiCall<UserPublic>(`/api/auth/users/${id}/approve`, { method: 'POST' });
}

export async function rejectUser(id: string): Promise<UserPublic> {
  return apiCall<UserPublic>(`/api/auth/users/${id}/reject`, { method: 'POST' });
}

export async function disableUser(id: string): Promise<UserPublic> {
  return apiCall<UserPublic>(`/api/auth/users/${id}/disable`, { method: 'POST' });
}

export async function promoteUser(id: string): Promise<UserPublic> {
  return apiCall<UserPublic>(`/api/auth/users/${id}/promote`, { method: 'POST' });
}
