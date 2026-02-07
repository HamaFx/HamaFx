import { z } from 'zod';
import { requireAuth } from '../../_lib/auth.js';
import { getAiAssetAnalysis } from '../../_lib/ai.js';
import { handleApi } from '../../_lib/handler.js';
import { fail, ok, parseJson, unauthorized } from '../../_lib/http.js';
import { handleOptions } from '../../_lib/request.js';
import { addAuditEvent } from '../../_lib/state.js';
import { rateLimit } from '../../_lib/redis.js';

const requestSchema = z.object({
  assetName: z.string().min(1).max(120),
  assetSymbol: z.string().min(1).max(20),
  context: z.record(z.string(), z.unknown()).default({}),
});

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const allowed = await rateLimit(`ai:analysis:${auth.userId}`, 30, 60);
    if (!allowed) return fail('AI analysis rate limit exceeded. Please retry shortly.', 429);

    const body = await parseJson<unknown>(request);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return fail('Invalid AI analysis payload', 400, parsed.error.flatten());

    const analysis = await getAiAssetAnalysis(parsed.data);

    await addAuditEvent(auth.userId, 'AI_ANALYSIS_REQUESTED', `Asset analysis generated for ${parsed.data.assetSymbol}`, {
      source: analysis.source,
      signal: analysis.signal,
      confidence: analysis.confidence,
    });

    return ok(analysis);
  });
}
