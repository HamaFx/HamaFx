import { z } from 'zod';
import { requireAuth } from '../../_lib/auth.js';
import { handleApi } from '../../_lib/handler.js';
import { fail, methodNotAllowed, ok, parseJson, unauthorized } from '../../_lib/http.js';
import { handleOptions } from '../../_lib/request.js';
import { importFullState } from '../../_lib/state.js';

const payloadSchema = z.object({
  dryRun: z.boolean().default(false),
  settings: z.record(z.string(), z.unknown()).optional(),
  portfolio: z.record(z.string(), z.unknown()).optional(),
  watchlists: z.array(z.record(z.string(), z.unknown())).optional(),
  alerts: z.array(z.record(z.string(), z.unknown())).optional(),
  chatMessages: z.array(z.record(z.string(), z.unknown())).optional(),
  auditEvents: z.array(z.record(z.string(), z.unknown())).optional(),
});

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const body = await parseJson<unknown>(request);
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) return fail('Invalid migration payload', 400, parsed.error.flatten());

    const report = await importFullState(auth.userId, parsed.data, parsed.data.dryRun);
    return ok(report);
  });
}

export async function GET(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
