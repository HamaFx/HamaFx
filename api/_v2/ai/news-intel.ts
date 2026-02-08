import { z } from 'zod';
import { requireAuth } from '../../_lib/auth.js';
import { getAiNewsIntel } from '../../_lib/ai.js';
import { handleApi } from '../../_lib/handler.js';
import { fail, ok, unauthorized } from '../../_lib/http.js';
import { rateLimit } from '../../_lib/redis.js';
import { handleOptions } from '../../_lib/request.js';
import { addAuditEvent } from '../../_lib/state.js';

const querySchema = z.object({
  category: z.enum(['all', 'crypto', 'forex', 'economy', 'general']).optional(),
  limit: z.coerce.number().int().min(6).max(30).optional(),
});

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const allowed = await rateLimit(`ai:news-intel:${auth.userId}`, 20, 60);
    if (!allowed) return fail('AI news intelligence rate limit exceeded. Please retry shortly.', 429);

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      category: url.searchParams.get('category') || undefined,
      limit: url.searchParams.get('limit') || undefined,
    });
    if (!parsed.success) return fail('Invalid AI news intelligence query', 400, parsed.error.flatten());

    const intel = await getAiNewsIntel({
      userId: auth.userId,
      category: parsed.data.category,
      limit: parsed.data.limit,
    });

    await addAuditEvent(auth.userId, 'AI_ANALYSIS_REQUESTED', 'AI news intelligence generated', {
      source: intel.source,
      regime: intel.regime,
      sentimentScore: intel.sentimentScore,
    });

    return ok(intel);
  });
}
