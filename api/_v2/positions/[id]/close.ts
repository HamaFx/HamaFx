import { z } from 'zod';
import { requireAuth } from '../../../_lib/auth.js';
import { handleApi } from '../../../_lib/handler.js';
import { fail, methodNotAllowed, ok, parseJson, unauthorized } from '../../../_lib/http.js';
import { getLegacyLatestUsdRatesMap } from '../../../_lib/forex/service.js';
import { handleOptions } from '../../../_lib/request.js';
import { addAuditEvent, getPortfolio, savePortfolio } from '../../../_lib/state.js';
import { closePosition, type PortfolioState } from '../../../_lib/trading.js';

const payloadSchema = z.object({
  currentPrice: z.number().positive(),
});

function positionIdFromUrl(request: Request): string {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const closeIndex = parts.lastIndexOf('close');
  if (closeIndex <= 0) return '';
  return decodeURIComponent(parts[closeIndex - 1]);
}

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const positionId = positionIdFromUrl(request);
    if (!positionId) return fail('Missing position id', 400);

    const body = await parseJson<unknown>(request);
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) return fail('Invalid close payload', 400, parsed.error.flatten());

    const state = (await getPortfolio(auth.userId)) as PortfolioState;
    const usdRates = await getLegacyLatestUsdRatesMap().catch(() => ({}));
    const result = closePosition({
      userId: auth.userId,
      state,
      positionId,
      currentPrice: parsed.data.currentPrice,
      usdRates,
    });

    if (!result.success) return fail(result.error, 400);

    await savePortfolio(auth.userId, result.nextState);
    await addAuditEvent(auth.userId, 'TRADE_EXECUTED', `Position ${positionId} closed`);

    return ok({ closed: true, trade: result.trade });
  });
}

export async function GET(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
