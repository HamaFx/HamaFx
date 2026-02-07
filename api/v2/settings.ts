import { z } from 'zod';
import { requireAuth } from '../_lib/auth';
import { handleApi } from '../_lib/handler';
import { fail, methodNotAllowed, ok, parseJson, unauthorized } from '../_lib/http';
import { handleOptions } from '../_lib/request';
import { addAuditEvent, getSettings, saveSettings } from '../_lib/state';

const settingsSchema = z.record(z.string(), z.unknown());

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();
    const settings = await getSettings(auth.userId);
    return ok(settings);
  });
}

export async function PUT(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const body = await parseJson(request);
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) return fail('Invalid settings payload', 400, parsed.error.flatten());

    await saveSettings(auth.userId, parsed.data);
    await addAuditEvent(auth.userId, 'SETTINGS_CHANGED', 'Updated user settings');

    return ok({ saved: true });
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
