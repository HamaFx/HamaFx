import { requireAuth } from '../../_lib/auth.js';
import { handleApi } from '../../_lib/handler.js';
import { fail, methodNotAllowed, ok, parseJson, unauthorized } from '../../_lib/http.js';
import { handleOptions } from '../../_lib/request.js';
import { addAuditEvent, getWatchlists, saveWatchlists } from '../../_lib/state.js';

function idFromUrl(request: Request): string {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  return decodeURIComponent(parts[parts.length - 1] || '');
}

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function DELETE(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const id = idFromUrl(request);
    const current = await getWatchlists(auth.userId);
    const next = current.filter((w) => String(w.id) !== id);
    await saveWatchlists(auth.userId, next);
    await addAuditEvent(auth.userId, 'WATCHLIST_MODIFIED', `Deleted watchlist ${id}`);
    return ok({ deleted: true });
  });
}

export async function PATCH(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const id = idFromUrl(request);
    const body = (await parseJson<Record<string, unknown>>(request)) ?? {};

    const current = await getWatchlists(auth.userId);
    const index = current.findIndex((w) => String(w.id) === id);
    if (index === -1) return fail('Watchlist not found', 404);

    const updated = {
      ...current[index],
      ...body,
      id,
      userId: auth.userId,
      updatedAt: new Date().toISOString(),
    };

    const next = [...current];
    next[index] = updated;
    await saveWatchlists(auth.userId, next);
    await addAuditEvent(auth.userId, 'WATCHLIST_MODIFIED', `Updated watchlist ${id}`);

    return ok({ updated: true });
  });
}

export async function GET(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}

export async function POST(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}

export async function PUT(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
