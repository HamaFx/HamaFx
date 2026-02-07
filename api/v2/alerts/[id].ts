import { requireAuth } from '../../_lib/auth';
import { handleApi } from '../../_lib/handler';
import { fail, methodNotAllowed, ok, parseJson, unauthorized } from '../../_lib/http';
import { handleOptions } from '../../_lib/request';
import { addAuditEvent, getAlerts, saveAlerts } from '../../_lib/state';

function idFromUrl(request: Request): string {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  return decodeURIComponent(parts[parts.length - 1] || '');
}

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function DELETE(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const id = idFromUrl(request);
    const current = await getAlerts(auth.userId);
    const next = current.filter((alert) => String(alert.id) !== id);
    await saveAlerts(auth.userId, next);
    await addAuditEvent(auth.userId, 'ALERT_CREATED', `Alert ${id} deleted`);
    return ok({ deleted: true });
  });
}

export async function PATCH(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const id = idFromUrl(request);
    const patch = (await parseJson<Record<string, unknown>>(request)) ?? {};

    const current = await getAlerts(auth.userId);
    const index = current.findIndex((alert) => String(alert.id) === id);
    if (index === -1) return fail('Alert not found', 404);

    const next = [...current];
    next[index] = { ...next[index], ...patch, id };

    await saveAlerts(auth.userId, next);
    await addAuditEvent(auth.userId, 'SETTINGS_CHANGED', `Alert ${id} updated`);
    return ok({ updated: true });
  });
}

export async function GET(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}

export async function POST(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}

export async function PUT(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
