import { requireAuth } from '../../_lib/auth';
import { handleApi } from '../../_lib/handler';
import { methodNotAllowed, ok, unauthorized } from '../../_lib/http';
import { handleOptions } from '../../_lib/request';
import { getUserById, sanitizeUser } from '../../_lib/users';

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
