import { z } from 'zod';
import { requireAuth } from '../../_lib/auth';
import { handleApi } from '../../_lib/handler';
import { fail, methodNotAllowed, ok, unauthorized } from '../../_lib/http';
import { getCryptoChart, getCryptoMarkets, getCryptoOHLC } from '../../_lib/market';
import { handleOptions } from '../../_lib/request';
import { rateLimit } from '../../_lib/redis';

const querySchema = z.object({
  mode: z.enum(['markets', 'ohlc', 'chart']).default('markets'),
  perPage: z.coerce.number().int().min(1).max(250).default(50),
  coinId: z.string().optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const allowed = await rateLimit(`market:crypto:${auth.userId}`, 120, 60);
    if (!allowed) return fail('Rate limit exceeded', 429);

    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) return fail('Invalid query', 400, parsed.error.flatten());

    if (parsed.data.mode === 'markets') {
      return ok(await getCryptoMarkets(parsed.data.perPage));
    }

    if (!parsed.data.coinId) {
      return fail('coinId is required for chart/ohlc mode', 400);
    }

    if (parsed.data.mode === 'ohlc') {
      return ok(await getCryptoOHLC(parsed.data.coinId, parsed.data.days));
    }

    return ok(await getCryptoChart(parsed.data.coinId, parsed.data.days));
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
