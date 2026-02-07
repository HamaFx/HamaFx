import { z } from 'zod';
import { requireAuth } from '../_lib/auth';
import { handleApi } from '../_lib/handler';
import { fail, methodNotAllowed, ok, parseJson, unauthorized } from '../_lib/http';
import { handleOptions } from '../_lib/request';
import { addAuditEvent, getWatchlists, saveWatchlists } from '../_lib/state';

const watchlistItemSchema = z.object({
  symbol: z.string(),
  assetType: z.string(),
  addedAt: z.string().optional(),
  sortOrder: z.number().optional(),
});

const watchlistSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  name: z.string(),
  symbols: z.array(watchlistItemSchema).default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();
    return ok(await getWatchlists(auth.userId));
  });
}

export async function PUT(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const body = await parseJson<unknown>(request);
    const parsed = z.array(watchlistSchema).safeParse(body);
    if (!parsed.success) return fail('Invalid watchlists payload', 400, parsed.error.flatten());

    const clean = parsed.data.map((item) => ({ ...item, userId: auth.userId }));
    await saveWatchlists(auth.userId, clean);
    await addAuditEvent(auth.userId, 'WATCHLIST_MODIFIED', 'Replaced watchlists collection');

    return ok({ saved: true, count: clean.length });
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const body = await parseJson<unknown>(request);
    const parsed = watchlistSchema.safeParse(body);
    if (!parsed.success) return fail('Invalid watchlist payload', 400, parsed.error.flatten());

    const current = await getWatchlists(auth.userId);
    const next = [...current, { ...parsed.data, userId: auth.userId }];
    await saveWatchlists(auth.userId, next);
    await addAuditEvent(auth.userId, 'WATCHLIST_MODIFIED', `Created watchlist ${parsed.data.name}`);

    return ok({ created: true });
  });
}

export async function DELETE(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
