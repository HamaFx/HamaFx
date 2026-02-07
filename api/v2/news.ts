import { z } from 'zod';
import { requireAuth } from '../_lib/auth';
import { handleApi } from '../_lib/handler';
import { fail, methodNotAllowed, ok, unauthorized } from '../_lib/http';
import { getNews } from '../_lib/news';
import { handleOptions } from '../_lib/request';
import { rateLimit } from '../_lib/redis';

const querySchema = z.object({
  category: z.enum(['all', 'crypto', 'forex', 'economy']).default('all'),
});

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const allowed = await rateLimit(`news:${auth.userId}`, 60, 60);
    if (!allowed) return fail('Rate limit exceeded', 429);

    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) return fail('Invalid query', 400, parsed.error.flatten());

    return ok(await getNews(parsed.data.category));
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
