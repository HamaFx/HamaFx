import { z } from 'zod';
import { requireAuth } from '../_lib/auth';
import { handleApi } from '../_lib/handler';
import { fail, methodNotAllowed, ok, parseJson, unauthorized } from '../_lib/http';
import { handleOptions } from '../_lib/request';
import { addAuditEvent, getPortfolio, getSettings, savePortfolio } from '../_lib/state';
import { placeOrder, type PortfolioState } from '../_lib/trading';

const orderSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  assetType: z.enum(['crypto', 'forex']),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['market', 'limit', 'stop']),
  quantity: z.number(),
  price: z.number(),
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
});

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const body = await parseJson<unknown>(request);
    const parsed = orderSchema.safeParse(body);
    if (!parsed.success) return fail('Invalid order payload', 400, parsed.error.flatten());

    const state = (await getPortfolio(auth.userId)) as PortfolioState;
    const settingsData = await getSettings(auth.userId);
    const tradingSettings = (settingsData.trading as Record<string, unknown>) ?? {
      enableRiskGuardrails: true,
      maxPositionSizePercent: 25,
      maxDailyLossPercent: 5,
      maxOpenPositions: 8,
      warnOnConcentration: true,
    };

    const result = placeOrder({
      userId: auth.userId,
      state,
      settings: {
        enableRiskGuardrails: Boolean(tradingSettings.enableRiskGuardrails ?? true),
        maxPositionSizePercent: Number(tradingSettings.maxPositionSizePercent ?? 25),
        maxDailyLossPercent: Number(tradingSettings.maxDailyLossPercent ?? 5),
        maxOpenPositions: Number(tradingSettings.maxOpenPositions ?? 8),
        warnOnConcentration: Boolean(tradingSettings.warnOnConcentration ?? true),
      },
      order: parsed.data,
    });

    if (!result.success) {
      await addAuditEvent(auth.userId, 'RISK_GUARDRAIL_BLOCKED', `Order blocked: ${result.error}`);
      return fail(result.error, 400, result.risk ?? undefined);
    }

    await savePortfolio(auth.userId, result.nextState);

    if (result.order.status === 'filled') {
      await addAuditEvent(auth.userId, 'TRADE_EXECUTED', `${parsed.data.side.toUpperCase()} ${parsed.data.quantity} ${parsed.data.symbol}`);
    } else {
      await addAuditEvent(auth.userId, 'ORDER_PLACED', `${parsed.data.type.toUpperCase()} ${parsed.data.side.toUpperCase()} ${parsed.data.quantity} ${parsed.data.symbol}`);
    }

    return ok({
      order: result.order,
      warnings: result.warnings,
      projected: result.risk?.projectedMetrics,
    });
  });
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();
    const state = await getPortfolio(auth.userId);
    return ok(state.orders);
  });
}

export async function PUT(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}

export async function DELETE(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
