import { eq } from 'drizzle-orm';
import { getDb, schema } from './db/client';

export async function getUserByEmail(email: string) {
  const db = getDb();
  const rows = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function getUserById(id: string) {
  const db = getDb();
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createUser(payload: {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
}) {
  const db = getDb();
  const now = new Date();
  await db.insert(schema.users).values({
    id: payload.id,
    email: payload.email,
    username: payload.username,
    passwordHash: payload.passwordHash,
    passwordSalt: payload.passwordSalt,
    createdAt: now,
    lastLoginAt: now,
    updatedAt: now,
  });
}

export async function touchLastLogin(userId: string) {
  const db = getDb();
  await db
    .update(schema.users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.users.id, userId));
}

export function sanitizeUser(user: {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
  lastLoginAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt.toISOString(),
  };
}
