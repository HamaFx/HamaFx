import { z } from 'zod';
import { requireAuth } from '../../_lib/auth.js';
import { getAiSentiment } from '../../_lib/ai.js';
import { handleApi } from '../../_lib/handler.js';
import { fail, ok, parseJson, unauthorized } from '../../_lib/http.js';
import { handleOptions } from '../../_lib/request.js';
import { addAuditEvent } from '../../_lib/state.js';
import { rateLimit } from '../../_lib/redis.js';

const requestSchema = z.object({
  assetSymbol: z.string().min(1).max(32),
  headlines: z.array(z.string().min(1).max(280)).max(30),
});

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const allowed = await rateLimit(`ai:sentiment:${auth.userId}`, 35, 60);
    if (!allowed) return fail('AI sentiment rate limit exceeded. Please retry shortly.', 429);

    const body = await parseJson<unknown>(request);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return fail('Invalid AI sentiment payload', 400, parsed.error.flatten());

    const sentiment = await getAiSentiment(parsed.data);

    await addAuditEvent(auth.userId, 'AI_ANALYSIS_REQUESTED', `Sentiment analysis generated for ${parsed.data.assetSymbol}`, {
      source: sentiment.source,
      overallSentiment: sentiment.overallSentiment,
    });

    return ok(sentiment);
  });
}
