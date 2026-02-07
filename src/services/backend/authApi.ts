import type { User } from '@/types';
import { backendFetch, setAccessToken } from './http';

interface AuthPayload {
  user: User;
  token: string;
}

function normalizeUser(user: User): User {
  return {
    ...user,
    passwordHash: user.passwordHash || '',
  };
}

export async function apiRegister(email: string, password: string, username: string): Promise<AuthPayload> {
  const data = await backendFetch<AuthPayload>('/api/v2/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, username }),
  });
  setAccessToken(data.token);
  return { ...data, user: normalizeUser(data.user) };
}

export async function apiLogin(email: string, password: string): Promise<AuthPayload> {
  const data = await backendFetch<AuthPayload>('/api/v2/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(data.token);
  return { ...data, user: normalizeUser(data.user) };
}

export async function apiMe(): Promise<User> {
  const data = await backendFetch<{ user: User }>('/api/v2/auth/me', { method: 'GET' });
  return normalizeUser(data.user);
}

export async function apiLogout(): Promise<void> {
  try {
    await backendFetch('/api/v2/auth/logout', { method: 'POST' });
  } finally {
    setAccessToken(null);
  }
}
