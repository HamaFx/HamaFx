import { requireAuth } from '../../_lib/auth.js';
import { handleApi } from '../../_lib/handler.js';
import { fail, methodNotAllowed, ok, unauthorized } from '../../_lib/http.js';
import { handleOptions } from '../../_lib/request.js';
import { addAuditEvent, getPortfolio, savePortfolio } from '../../_lib/state.js';

type OrderRecord = Record<string, unknown>;

function orderIdFromUrl(request: Request): string {
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

    const id = orderIdFromUrl(request);
    if (!id) return fail('Missing order id', 400);

    const state = await getPortfolio(auth.userId);
    const index = state.orders.findIndex((order) => String((order as OrderRecord).id) === id);
    if (index < 0) return fail('Order not found', 404);

    const existingOrder = (state.orders[index] as OrderRecord) ?? {};
    state.orders[index] = {
      ...existingOrder,
      status: 'cancelled',
      statusReason: 'Cancelled by user',
    };

    await savePortfolio(auth.userId, state);
    await addAuditEvent(auth.userId, 'ORDER_CANCELLED', `Order ${id} cancelled`);

    return ok({ cancelled: true });
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

export async function PATCH(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
