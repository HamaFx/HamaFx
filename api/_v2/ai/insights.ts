import { requireAuth } from '../../_lib/auth.js';
import { getAiDashboardInsights } from '../../_lib/ai.js';
import { handleApi } from '../../_lib/handler.js';
import { fail, ok, unauthorized } from '../../_lib/http.js';
import { handleOptions } from '../../_lib/request.js';
import { addAuditEvent } from '../../_lib/state.js';
import { rateLimit } from '../../_lib/redis.js';

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const allowed = await rateLimit(`ai:insights:${auth.userId}`, 20, 60);
    if (!allowed) return fail('AI insights rate limit exceeded. Please retry shortly.', 429);

    const insights = await getAiDashboardInsights(auth.userId);

    await addAuditEvent(auth.userId, 'AI_ANALYSIS_REQUESTED', 'Dashboard AI insights generated', {
      source: insights.source,
      marketMood: insights.marketMood,
    });

    return ok(insights);
  });
}
