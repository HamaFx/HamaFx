import { z } from 'zod';
import { requireAuth } from '../../../_lib/auth.js';
import { handleApi } from '../../../_lib/handler.js';
import { fail, methodNotAllowed, ok, unauthorized } from '../../../_lib/http.js';
import { getForexCandleSeries } from '../../../_lib/forex/service.js';
import { handleOptions } from '../../../_lib/request.js';
import { rateLimit } from '../../../_lib/redis.js';

const querySchema = z.object({
  symbol: z.string().min(3),
  interval: z.string().optional(),
  range: z.string().optional(),
});

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const allowed = await rateLimit(`market:forex:candles:${auth.userId}`, 120, 60);
    if (!allowed) return fail('Rate limit exceeded', 429);

    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) return fail('Invalid query', 400, parsed.error.flatten());

    try {
      const series = await getForexCandleSeries(parsed.data);
      return ok({ ...series });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Unable to load forex candles', 400);
    }
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
