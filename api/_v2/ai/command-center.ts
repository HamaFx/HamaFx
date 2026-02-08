import { requireAuth } from '../../_lib/auth.js';
import { getAiCommandCenter } from '../../_lib/ai.js';
import { handleApi } from '../../_lib/handler.js';
import { fail, ok, unauthorized } from '../../_lib/http.js';
import { rateLimit } from '../../_lib/redis.js';
import { handleOptions } from '../../_lib/request.js';
import { addAuditEvent } from '../../_lib/state.js';

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const allowed = await rateLimit(`ai:command-center:${auth.userId}`, 25, 60);
    if (!allowed) return fail('AI command center rate limit exceeded. Please retry shortly.', 429);

    const commandCenter = await getAiCommandCenter(auth.userId);

    await addAuditEvent(auth.userId, 'AI_ANALYSIS_REQUESTED', 'AI command center snapshot generated', {
      source: commandCenter.source,
      posture: commandCenter.posture,
      confidence: commandCenter.confidence,
    });

    return ok(commandCenter);
  });
}
