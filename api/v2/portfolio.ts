import { z } from 'zod';
import { requireAuth } from '../_lib/auth';
import { handleApi } from '../_lib/handler';
import { fail, methodNotAllowed, ok, parseJson, unauthorized } from '../_lib/http';
import { handleOptions } from '../_lib/request';
import { addAuditEvent, getPortfolio, savePortfolio } from '../_lib/state';

const payloadSchema = z.object({
  virtualBalance: z.number(),
  totalDeposited: z.number(),
  positions: z.array(z.record(z.string(), z.unknown())),
  orders: z.array(z.record(z.string(), z.unknown())),
  tradeHistory: z.array(z.record(z.string(), z.unknown())),
  balanceHistory: z.array(z.record(z.string(), z.unknown())),
});

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    return ok(await getPortfolio(auth.userId));
  });
}

export async function PUT(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const body = await parseJson<unknown>(request);
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) return fail('Invalid portfolio payload', 400, parsed.error.flatten());

    await savePortfolio(auth.userId, parsed.data);
    await addAuditEvent(auth.userId, 'SETTINGS_CHANGED', 'Portfolio snapshot synchronized');
    return ok({ saved: true });
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
