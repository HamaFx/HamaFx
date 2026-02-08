import { z } from 'zod';
import { requireAuth } from '../../_lib/auth.js';
import {
  getForexCandleSeries,
  getForexPairCatalog,
  getForexQuotes,
  getLegacyHistory,
  getLegacyLatestUsdRatesMap,
} from '../../_lib/forex/service.js';
import { handleApi } from '../../_lib/handler.js';
import { fail, methodNotAllowed, ok, unauthorized } from '../../_lib/http.js';
import { handleOptions } from '../../_lib/request.js';
import { rateLimit } from '../../_lib/redis.js';

const querySchema = z.object({
  mode: z.enum(['latest', 'history', 'pairs', 'quotes', 'candles']).default('latest'),
  symbols: z.string().optional(),
  symbol: z.string().optional(),
  interval: z.string().optional(),
  range: z.string().optional(),
  base: z.string().default('USD'),
  quote: z.string().default('EUR'),
  from: z.string().optional(),
  to: z.string().optional(),
});

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

function parseSymbols(value?: string): string[] | undefined {
  if (!value) return undefined;
  const symbols = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return symbols.length > 0 ? symbols : undefined;
}

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const allowed = await rateLimit(`market:forex:${auth.userId}`, 120, 60);
    if (!allowed) return fail('Rate limit exceeded', 429);

    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) return fail('Invalid query', 400, parsed.error.flatten());

    if (parsed.data.mode === 'latest') {
      return ok(await getLegacyLatestUsdRatesMap());
    }

    if (parsed.data.mode === 'pairs') {
      return ok(await getForexPairCatalog(parseSymbols(parsed.data.symbols)));
    }

    if (parsed.data.mode === 'quotes') {
      return ok(await getForexQuotes(parseSymbols(parsed.data.symbols)));
    }

    if (parsed.data.mode === 'candles') {
      if (!parsed.data.symbol) return fail('symbol is required for candles mode', 400);
      try {
        const candles = await getForexCandleSeries({
          symbol: parsed.data.symbol,
          interval: parsed.data.interval,
          range: parsed.data.range,
        });
        return ok({ ...candles });
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Unable to fetch candles', 400);
      }
    }

    const range = defaultRange();
    const from = parsed.data.from ?? range.from;
    const to = parsed.data.to ?? range.to;

    return ok(await getLegacyHistory(parsed.data.base, parsed.data.quote, from, to));
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
