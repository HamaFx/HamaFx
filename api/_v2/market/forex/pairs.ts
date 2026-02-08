import { z } from 'zod';
import { requireAuth } from '../../../_lib/auth.js';
import { handleApi } from '../../../_lib/handler.js';
import { fail, methodNotAllowed, ok, unauthorized } from '../../../_lib/http.js';
import { getForexPairCatalog } from '../../../_lib/forex/service.js';
import { handleOptions } from '../../../_lib/request.js';
import { rateLimit } from '../../../_lib/redis.js';

const querySchema = z.object({
  symbols: z.string().optional(),
});

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

    const allowed = await rateLimit(`market:forex:pairs:${auth.userId}`, 120, 60);
    if (!allowed) return fail('Rate limit exceeded', 429);

    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) return fail('Invalid query', 400, parsed.error.flatten());

    const symbols = parseSymbols(parsed.data.symbols);
    return ok(await getForexPairCatalog(symbols));
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
