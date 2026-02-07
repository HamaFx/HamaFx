import { requireAuth } from '../_lib/auth.js';
import { handleApi } from '../_lib/handler.js';
import { methodNotAllowed, ok, unauthorized } from '../_lib/http.js';
import { handleOptions, parsePagination } from '../_lib/request.js';
import { getAuditEvents } from '../_lib/state.js';

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const { limit, offset } = parsePagination(request, 100, 1000);
    const events = await getAuditEvents(auth.userId, limit, offset);

    return ok(events);
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
