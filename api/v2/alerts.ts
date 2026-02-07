import { z } from 'zod';
import { requireAuth } from '../_lib/auth';
import { handleApi } from '../_lib/handler';
import { fail, methodNotAllowed, ok, parseJson, unauthorized } from '../_lib/http';
import { handleOptions } from '../_lib/request';
import { addAuditEvent, getAlerts, saveAlerts } from '../_lib/state';

const alertSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  assetType: z.string(),
  type: z.string(),
  targetValue: z.number(),
  currentValue: z.number().optional(),
  isTriggered: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  triggeredAt: z.string().optional(),
  notificationSent: z.boolean().optional(),
});

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();
    return ok(await getAlerts(auth.userId));
  });
}

export async function PUT(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const body = await parseJson<unknown>(request);
    const parsed = z.array(alertSchema).safeParse(body);
    if (!parsed.success) return fail('Invalid alerts payload', 400, parsed.error.flatten());

    await saveAlerts(auth.userId, parsed.data);
    await addAuditEvent(auth.userId, 'SETTINGS_CHANGED', 'Updated alerts collection');
    return ok({ saved: true, count: parsed.data.length });
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const body = await parseJson<unknown>(request);
    const parsed = alertSchema.safeParse(body);
    if (!parsed.success) return fail('Invalid alert payload', 400, parsed.error.flatten());

    const current = await getAlerts(auth.userId);
    const next = [parsed.data, ...current];
    await saveAlerts(auth.userId, next);
    await addAuditEvent(auth.userId, 'ALERT_CREATED', `Alert created for ${parsed.data.symbol}`);
    return ok({ created: true });
  });
}

export async function DELETE(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
