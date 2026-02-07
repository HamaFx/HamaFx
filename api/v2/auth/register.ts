import { z } from 'zod';
import {
  buildRefreshCookie,
  createAccessToken,
  createSession,
  getRequestIp,
  hashPassword,
} from '../../_lib/auth';
import { handleApi } from '../../_lib/handler';
import { fail, methodNotAllowed, ok, parseJson } from '../../_lib/http';
import { rateLimit } from '../../_lib/redis';
import { addAuditEvent, ensureUserState } from '../../_lib/state';
import { createUser, getUserByEmail, sanitizeUser } from '../../_lib/users';
import { handleOptions } from '../../_lib/request';

const payloadSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  username: z.string().min(2).max(40),
});

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const ip = getRequestIp(request) ?? 'unknown';
    const allowed = await rateLimit(`auth:register:${ip}`, 10, 60);
    if (!allowed) return fail('Too many requests', 429);

    const body = await parseJson(request);
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) return fail('Invalid payload', 400, parsed.error.flatten());

    const email = parsed.data.email.toLowerCase().trim();
    const existing = await getUserByEmail(email);
    if (existing) return fail('Email already registered', 409);

    const { hash, salt } = hashPassword(parsed.data.password);
    const userId = crypto.randomUUID();

    await createUser({
      id: userId,
      email,
      username: parsed.data.username.trim(),
      passwordHash: hash,
      passwordSalt: salt,
    });

    await ensureUserState(userId);

    const created = await getUserByEmail(email);
    if (!created) return fail('Failed to create user', 500);

    const session = await createSession({
      userId,
      userAgent: request.headers.get('user-agent'),
      ipAddress: ip,
    });

    const safeUser = sanitizeUser(created);
    const accessToken = createAccessToken(safeUser, session.sessionId);

    await addAuditEvent(userId, 'REGISTER', `User ${safeUser.username} registered`);

    return ok(
      {
        user: safeUser,
        token: accessToken,
      },
      {
        'set-cookie': buildRefreshCookie(session.refreshToken),
      }
    );
  });
}

export async function GET(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
