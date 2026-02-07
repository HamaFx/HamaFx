import { z } from 'zod';
import { requireAuth } from '../../_lib/auth.js';
import { getAiTradeEvaluation } from '../../_lib/ai.js';
import { handleApi } from '../../_lib/handler.js';
import { fail, ok, parseJson, unauthorized } from '../../_lib/http.js';
import { handleOptions } from '../../_lib/request.js';
import { addAuditEvent } from '../../_lib/state.js';
import { rateLimit } from '../../_lib/redis.js';

const requestSchema = z.object({
  side: z.enum(['buy', 'sell']),
  symbol: z.string().min(1).max(20),
  quantity: z.number().positive(),
  price: z.number().positive(),
  portfolioValue: z.number().positive(),
  assetType: z.enum(['crypto', 'forex']),
});

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const allowed = await rateLimit(`ai:trade-eval:${auth.userId}`, 30, 60);
    if (!allowed) return fail('AI trade-eval rate limit exceeded. Please retry shortly.', 429);

    const body = await parseJson<unknown>(request);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return fail('Invalid AI trade evaluation payload', 400, parsed.error.flatten());

    const evaluation = await getAiTradeEvaluation(parsed.data);

    await addAuditEvent(auth.userId, 'AI_ANALYSIS_REQUESTED', `Trade evaluation generated for ${parsed.data.side.toUpperCase()} ${parsed.data.symbol}`, {
      source: evaluation.source,
      riskRating: evaluation.riskRating,
    });

    return ok(evaluation);
  });
}
