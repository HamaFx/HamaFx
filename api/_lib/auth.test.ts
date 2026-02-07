import { describe, expect, it } from 'vitest';
import { createAccessToken, hashPassword, verifyAccessToken, verifyPassword } from './auth.js';

describe('api auth utils', () => {
  it('hashes and verifies passwords', () => {
    const { hash, salt } = hashPassword('strong-pass-123');
    expect(hash).toMatch(/[a-f0-9]+/);
    expect(verifyPassword('strong-pass-123', salt, hash)).toBe(true);
    expect(verifyPassword('wrong-pass', salt, hash)).toBe(false);
  });

  it('creates and verifies JWT access token', () => {
    process.env.AUTH_JWT_SECRET = '1234567890abcdef1234567890abcdef';
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
    process.env.CRON_SECRET = 'secret-secret-123';
    process.env.CORS_ALLOWED_ORIGIN = 'https://example.com';

    const token = createAccessToken(
      {
        id: 'u1',
        email: 'u1@example.com',
        username: 'u1',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      },
      'session-1'
    );

    const payload = verifyAccessToken(token);
    expect(payload).toBeTruthy();
    expect(payload?.sub).toBe('u1');
    expect(payload?.sid).toBe('session-1');
  });
});
