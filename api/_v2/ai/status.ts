import { requireAuth } from '../../_lib/auth.js';
import { getAiRuntimeStatus } from '../../_lib/ai.js';
import { handleApi } from '../../_lib/handler.js';
import { fail, ok, unauthorized } from '../../_lib/http.js';
import { rateLimit } from '../../_lib/redis.js';
import { handleOptions } from '../../_lib/request.js';

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const allowed = await rateLimit(`ai:status:${auth.userId}`, 80, 60);
    if (!allowed) return fail('AI status rate limit exceeded. Please retry shortly.', 429);

    const status = getAiRuntimeStatus();
    return ok(status);
  });
}
