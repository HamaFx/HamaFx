import { z } from 'zod';
import { requireAuth } from '../_lib/auth';
import { handleApi } from '../_lib/handler';
import { fail, methodNotAllowed, ok, parseJson, unauthorized } from '../_lib/http';
import { handleOptions } from '../_lib/request';
import {
  getAlerts,
  getAuditEvents,
  getChatMessages,
  getPortfolio,
  getSettings,
  getWatchlists,
  saveAlerts,
  saveChatMessages,
  savePortfolio,
  saveSettings,
  saveWatchlists,
} from '../_lib/state';

const statePayloadSchema = z.object({
  settings: z.record(z.string(), z.unknown()),
  portfolio: z.object({
    virtualBalance: z.number(),
    totalDeposited: z.number(),
    positions: z.array(z.record(z.string(), z.unknown())),
    orders: z.array(z.record(z.string(), z.unknown())),
    tradeHistory: z.array(z.record(z.string(), z.unknown())),
    balanceHistory: z.array(z.record(z.string(), z.unknown())),
  }),
  watchlists: z.array(z.record(z.string(), z.unknown())),
  alerts: z.array(z.record(z.string(), z.unknown())),
  chatMessages: z.array(z.record(z.string(), z.unknown())),
});

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const [settings, portfolio, watchlists, alerts, chatMessages, auditEvents] = await Promise.all([
      getSettings(auth.userId),
      getPortfolio(auth.userId),
      getWatchlists(auth.userId),
      getAlerts(auth.userId),
      getChatMessages(auth.userId, 200),
      getAuditEvents(auth.userId, 200, 0),
    ]);

    return ok({ settings, portfolio, watchlists, alerts, chatMessages, auditEvents });
  });
}

export async function PUT(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const body = await parseJson<unknown>(request);
    const parsed = statePayloadSchema.safeParse(body);
    if (!parsed.success) return fail('Invalid state payload', 400, parsed.error.flatten());

    await Promise.all([
      saveSettings(auth.userId, parsed.data.settings),
      savePortfolio(auth.userId, parsed.data.portfolio),
      saveWatchlists(auth.userId, parsed.data.watchlists),
      saveAlerts(auth.userId, parsed.data.alerts),
      saveChatMessages(auth.userId, parsed.data.chatMessages),
    ]);

    return ok({ saved: true });
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
