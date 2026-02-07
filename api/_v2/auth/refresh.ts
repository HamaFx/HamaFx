import { buildRefreshCookie, createAccessToken, createSession, revokeSession, validateRefreshToken } from '../../_lib/auth.js';
import { handleApi } from '../../_lib/handler.js';
import { methodNotAllowed, ok, unauthorized } from '../../_lib/http.js';
import { handleOptions } from '../../_lib/request.js';
import { getUserById, sanitizeUser } from '../../_lib/users.js';

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const refresh = await validateRefreshToken(request);
    if (!refresh) return unauthorized('Invalid refresh session');

    const user = await getUserById(refresh.userId);
    if (!user) return unauthorized('User not found');

    // Rotate refresh session
    await revokeSession(refresh.sessionId);
    const nextSession = await createSession({
      userId: user.id,
      userAgent: request.headers.get('user-agent'),
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    });

    const safeUser = sanitizeUser(user);
    const accessToken = createAccessToken(safeUser, nextSession.sessionId);

    return ok(
      {
        user: safeUser,
        token: accessToken,
      },
      {
        'set-cookie': buildRefreshCookie(nextSession.refreshToken),
      }
    );
  });
}

export async function GET(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
