import { clearRefreshCookie, requireAuth, revokeSession } from '../../_lib/auth.js';
import { handleApi } from '../../_lib/handler.js';
import { methodNotAllowed, ok, unauthorized } from '../../_lib/http.js';
import { handleOptions } from '../../_lib/request.js';
import { addAuditEvent } from '../../_lib/state.js';

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    await revokeSession(auth.sessionId);
    await addAuditEvent(auth.userId, 'LOGOUT', 'User logged out');

    return ok(
      { success: true },
      {
        'set-cookie': clearRefreshCookie(),
      }
    );
  });
}

export async function GET(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
