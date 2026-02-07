import { z } from 'zod';
import { requireAuth } from '../../_lib/auth';
import { handleApi } from '../../_lib/handler';
import { fail, methodNotAllowed, ok, unauthorized } from '../../_lib/http';
import { getForexHistory, getForexRates } from '../../_lib/market';
import { handleOptions } from '../../_lib/request';
import { rateLimit } from '../../_lib/redis';

const querySchema = z.object({
  mode: z.enum(['latest', 'history']).default('latest'),
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
      return ok(await getForexRates());
    }

    const range = defaultRange();
    const from = parsed.data.from ?? range.from;
    const to = parsed.data.to ?? range.to;

    return ok(await getForexHistory(parsed.data.base, parsed.data.quote, from, to));
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
