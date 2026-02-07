import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb, schema } from './db/client';
import { getEnv } from './env';

const ACCESS_TTL_SECONDS = 60 * 15;
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 14;

export type JwtPayload = {
  sub: string;
  email: string;
  sid: string;
  iat: number;
  exp: number;
};

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  lastLoginAt: string;
};

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function toBase64Url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function fromBase64Url<T>(input: string): T {
  return JSON.parse(Buffer.from(input, 'base64url').toString('utf8')) as T;
}

function sign(content: string): string {
  const env = getEnv();
  return createHmac('sha256', env.AUTH_JWT_SECRET).update(content).digest('base64url');
}

function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get('cookie');
  if (!header) return {};
  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const idx = part.indexOf('=');
      if (idx === -1) return acc;
      const key = part.slice(0, idx);
      const value = part.slice(idx + 1);
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
  return value;
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const passwordSalt = salt ?? randomBytes(16).toString('hex');
  const hash = scryptSync(password, passwordSalt, 64).toString('hex');
  return { hash, salt: passwordSalt };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const { hash } = hashPassword(password, salt);
  const left = Buffer.from(hash, 'hex');
  const right = Buffer.from(expectedHash, 'hex');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createAccessToken(user: AuthUser, sessionId: string): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    sid: sessionId,
    iat: nowSeconds(),
    exp: nowSeconds() + ACCESS_TTL_SECONDS,
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = toBase64Url(JSON.stringify(header));
  const p = toBase64Url(JSON.stringify(payload));
  const content = `${h}.${p}`;
  const signature = sign(content);
  return `${content}.${signature}`;
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const content = `${h}.${p}`;
    const expectedSig = Buffer.from(sign(content), 'utf8');
    const receivedSig = Buffer.from(s, 'utf8');
    if (expectedSig.length !== receivedSig.length) return null;
    if (!timingSafeEqual(expectedSig, receivedSig)) return null;
    const payload = fromBase64Url<JwtPayload>(p);
    if (payload.exp <= nowSeconds()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function buildRefreshCookie(token: string): string {
  const isSecure = getEnv().NODE_ENV === 'production';
  const attrs = [
    `refresh_token=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${REFRESH_TTL_SECONDS}`,
  ];
  if (isSecure) attrs.push('Secure');
  return attrs.join('; ');
}

export function clearRefreshCookie(): string {
  const isSecure = getEnv().NODE_ENV === 'production';
  const attrs = [
    'refresh_token=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isSecure) attrs.push('Secure');
  return attrs.join('; ');
}

export async function createSession(params: {
  userId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}) {
  const db = getDb();
  const sessionId = randomBytes(16).toString('hex');
  const refreshToken = createRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);

  await db.insert(schema.sessions).values({
    id: sessionId,
    userId: params.userId,
    refreshTokenHash,
    userAgent: params.userAgent ?? null,
    ipAddress: params.ipAddress ?? null,
    expiresAt,
  });

  return { sessionId, refreshToken, expiresAt };
}

export async function revokeSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(eq(schema.sessions.id, sessionId));
}

export async function validateRefreshToken(request: Request): Promise<{ userId: string; sessionId: string } | null> {
  const cookies = parseCookies(request);
  const refresh = cookies.refresh_token;
  if (!refresh) return null;

  const refreshHash = hashToken(refresh);
  const db = getDb();
  const rows = await db
    .select({ session: schema.sessions })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.refreshTokenHash, refreshHash), isNull(schema.sessions.revokedAt)));

  const row = rows[0]?.session;
  if (!row) return null;

  const expiresAt = new Date(row.expiresAt);
  if (expiresAt.getTime() <= Date.now()) {
    await revokeSession(row.id);
    return null;
  }

  return { userId: row.userId, sessionId: row.id };
}

export function getRequestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (!forwarded) return null;
  return forwarded.split(',')[0]?.trim() || null;
}

export async function requireAuth(request: Request): Promise<{ userId: string; sessionId: string } | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const db = getDb();
  const session = await db
    .select({ id: schema.sessions.id, revokedAt: schema.sessions.revokedAt, expiresAt: schema.sessions.expiresAt })
    .from(schema.sessions)
    .where(eq(schema.sessions.id, payload.sid));

  const current = session[0];
  if (!current || current.revokedAt) return null;
  if (new Date(current.expiresAt).getTime() <= Date.now()) return null;

  return { userId: payload.sub, sessionId: payload.sid };
}
