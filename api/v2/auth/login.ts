import { z } from 'zod';
import {
  buildRefreshCookie,
  createAccessToken,
  createSession,
  getRequestIp,
  verifyPassword,
} from '../../_lib/auth';
import { handleApi } from '../../_lib/handler';
import { fail, methodNotAllowed, ok, parseJson } from '../../_lib/http';
import { rateLimit } from '../../_lib/redis';
import { addAuditEvent, ensureUserState } from '../../_lib/state';
import { getUserByEmail, sanitizeUser, touchLastLogin } from '../../_lib/users';
import { handleOptions } from '../../_lib/request';

const payloadSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const ip = getRequestIp(request) ?? 'unknown';
    const allowed = await rateLimit(`auth:login:${ip}`, 20, 60);
    if (!allowed) return fail('Too many requests', 429);

    const body = await parseJson(request);
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) return fail('Invalid payload', 400, parsed.error.flatten());

    const email = parsed.data.email.toLowerCase().trim();
    const user = await getUserByEmail(email);
    if (!user) return fail('Invalid credentials', 401);

    const valid = verifyPassword(parsed.data.password, user.passwordSalt, user.passwordHash);
    if (!valid) return fail('Invalid credentials', 401);

    await touchLastLogin(user.id);
    await ensureUserState(user.id);

    const session = await createSession({
      userId: user.id,
      userAgent: request.headers.get('user-agent'),
      ipAddress: ip,
    });

    const safeUser = sanitizeUser({ ...user, lastLoginAt: new Date() });
    const accessToken = createAccessToken(safeUser, session.sessionId);

    await addAuditEvent(user.id, 'LOGIN', `User ${safeUser.username} logged in`);

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
