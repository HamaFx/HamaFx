import { requireAuth } from '../_lib/auth';
import { handleApi } from '../_lib/handler';
import { methodNotAllowed, ok, unauthorized } from '../_lib/http';
import { handleOptions, parsePagination } from '../_lib/request';
import { getPortfolio } from '../_lib/state';

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const { limit, offset } = parsePagination(request, 100, 1000);
    const state = await getPortfolio(auth.userId);
    const list = state.tradeHistory.slice(offset, offset + limit);
    return ok(list);
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
