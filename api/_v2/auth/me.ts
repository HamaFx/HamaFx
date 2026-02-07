import { requireAuth } from '../../_lib/auth.js';
import { handleApi } from '../../_lib/handler.js';
import { methodNotAllowed, ok, unauthorized } from '../../_lib/http.js';
import { handleOptions } from '../../_lib/request.js';
import { getUserById, sanitizeUser } from '../../_lib/users.js';

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const user = await getUserById(auth.userId);
    if (!user) return unauthorized();

    return ok({ user: sanitizeUser(user) });
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
