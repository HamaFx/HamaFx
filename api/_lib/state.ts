import { asc, desc, eq } from 'drizzle-orm';
import { getDb, schema } from './db/client.js';

type AnyRecord = Record<string, unknown>;
type PortfolioSnapshot = {
  virtualBalance: number;
  totalDeposited: number;
  positions: unknown[];
  orders: unknown[];
  tradeHistory: unknown[];
  balanceHistory: unknown[];
};

const DEFAULT_SETTINGS = {
  theme: 'dark',
  apiKeys: {},
  chartPreferences: {
    type: 'candlestick',
    indicators: ['RSI', 'MACD'],
    timeframe: '1D',
    showVolume: true,
  },
  notifications: {
    priceAlerts: true,
    signalAlerts: true,
    soundEnabled: false,
    browserNotifications: false,
  },
  trading: {
    defaultOrderType: 'market',
    confirmBeforeTrade: true,
    defaultStopLossPercent: 5,
    defaultTakeProfitPercent: 10,
    enableRiskGuardrails: true,
    maxPositionSizePercent: 25,
    maxDailyLossPercent: 5,
    maxOpenPositions: 8,
    warnOnConcentration: true,
  },
  ai: {
    enableAiAnalysis: true,
    autoAnalyzeOnView: false,
    showAiDisclaimer: true,
  },
};

const DEFAULT_PORTFOLIO: PortfolioSnapshot = {
  virtualBalance: 100000,
  totalDeposited: 100000,
  positions: [],
  orders: [],
  tradeHistory: [],
  balanceHistory: [{ timestamp: new Date().toISOString(), totalValue: 100000, cashBalance: 100000 }],
};

function toNumber(value: string | number | null | undefined, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export async function ensureUserState(userId: string): Promise<void> {
  const db = getDb();

  const settingsRow = await db
    .select({ userId: schema.settings.userId })
    .from(schema.settings)
    .where(eq(schema.settings.userId, userId));

  if (!settingsRow[0]) {
    await db.insert(schema.settings).values({ userId, data: DEFAULT_SETTINGS });
  }

  const portfolioRow = await db
    .select({ userId: schema.portfolios.userId })
    .from(schema.portfolios)
    .where(eq(schema.portfolios.userId, userId));

  if (!portfolioRow[0]) {
    await db.insert(schema.portfolios).values({
      userId,
      virtualBalance: String(DEFAULT_PORTFOLIO.virtualBalance),
      totalDeposited: String(DEFAULT_PORTFOLIO.totalDeposited),
      balanceHistory: DEFAULT_PORTFOLIO.balanceHistory,
    });
  }
}

export async function getSettings(userId: string): Promise<AnyRecord> {
  await ensureUserState(userId);
  const db = getDb();
  const rows = await db
    .select({ data: schema.settings.data })
    .from(schema.settings)
    .where(eq(schema.settings.userId, userId));
  return (rows[0]?.data as AnyRecord) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(userId: string, data: AnyRecord): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.settings)
    .values({ userId, data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.settings.userId,
      set: { data, updatedAt: new Date() },
    });
}

export async function getWatchlists(userId: string): Promise<AnyRecord[]> {
  const db = getDb();
  const watchlistRows = await db
    .select()
    .from(schema.watchlists)
    .where(eq(schema.watchlists.userId, userId))
    .orderBy(asc(schema.watchlists.createdAt));

  if (watchlistRows.length === 0) return [];

  const itemRows = await db
    .select()
    .from(schema.watchlistItems)
    .where(eq(schema.watchlistItems.userId, userId))
    .orderBy(asc(schema.watchlistItems.sortOrder));

  const itemsByWatchlist = new Map<string, AnyRecord[]>();
  for (const item of itemRows) {
    const current = itemsByWatchlist.get(item.watchlistId) ?? [];
    current.push({
      symbol: item.symbol,
      assetType: item.assetType,
      addedAt: item.addedAt.toISOString(),
      sortOrder: item.sortOrder,
    });
    itemsByWatchlist.set(item.watchlistId, current);
  }

  return watchlistRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    name: row.name,
    symbols: itemsByWatchlist.get(row.id) ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function saveWatchlists(userId: string, watchlists: AnyRecord[]): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(schema.watchlistItems).where(eq(schema.watchlistItems.userId, userId));
    await tx.delete(schema.watchlists).where(eq(schema.watchlists.userId, userId));

    for (const watchlist of watchlists) {
      const watchlistId = String(watchlist.id);
      await tx.insert(schema.watchlists).values({
        id: watchlistId,
        userId,
        name: String(watchlist.name ?? 'Watchlist'),
        createdAt: watchlist.createdAt ? new Date(String(watchlist.createdAt)) : new Date(),
        updatedAt: watchlist.updatedAt ? new Date(String(watchlist.updatedAt)) : new Date(),
      });

      const symbols = Array.isArray(watchlist.symbols) ? watchlist.symbols : [];
      for (let i = 0; i < symbols.length; i += 1) {
        const symbol = symbols[i] as AnyRecord;
        await tx.insert(schema.watchlistItems).values({
          id: crypto.randomUUID(),
          userId,
          watchlistId,
          symbol: String(symbol.symbol ?? ''),
          assetType: String(symbol.assetType ?? 'crypto'),
          sortOrder: Number(symbol.sortOrder ?? i),
          addedAt: symbol.addedAt ? new Date(String(symbol.addedAt)) : new Date(),
        });
      }
    }
  });
}

export async function getAlerts(userId: string): Promise<AnyRecord[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.alerts)
    .where(eq(schema.alerts.userId, userId))
    .orderBy(desc(schema.alerts.createdAt));

  return rows.map((row) => ({
    ...row.data,
    id: row.id,
    userId: row.userId,
    symbol: row.symbol,
    assetType: row.assetType,
    isActive: row.isActive,
    isTriggered: row.isTriggered,
    createdAt: row.createdAt.toISOString(),
    triggeredAt: row.triggeredAt ? row.triggeredAt.toISOString() : undefined,
  }));
}

export async function saveAlerts(userId: string, alerts: AnyRecord[]): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(schema.alerts).where(eq(schema.alerts.userId, userId));

    for (const alert of alerts) {
      await tx.insert(schema.alerts).values({
        id: String(alert.id),
        userId,
        symbol: String(alert.symbol ?? ''),
        assetType: String(alert.assetType ?? 'crypto'),
        isActive: Boolean(alert.isActive ?? true),
        isTriggered: Boolean(alert.isTriggered ?? false),
        createdAt: alert.createdAt ? new Date(String(alert.createdAt)) : new Date(),
        triggeredAt: alert.triggeredAt ? new Date(String(alert.triggeredAt)) : null,
        data: alert,
      });
    }
  });
}

export async function getChatMessages(userId: string, limit = 100): Promise<AnyRecord[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.userId, userId))
    .orderBy(desc(schema.chatMessages.timestamp))
    .limit(limit);

  return [...rows]
    .reverse()
    .map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      context: row.context ?? undefined,
      timestamp: new Date(row.timestamp).getTime(),
    }));
}

export async function saveChatMessages(userId: string, messages: AnyRecord[]): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(schema.chatMessages).where(eq(schema.chatMessages.userId, userId));

    const slice = messages.slice(-200);
    for (const msg of slice) {
      await tx.insert(schema.chatMessages).values({
        id: String(msg.id ?? crypto.randomUUID()),
        userId,
        role: String(msg.role ?? 'assistant'),
        content: String(msg.content ?? ''),
        context: msg.context ? String(msg.context) : null,
        timestamp: msg.timestamp ? new Date(Number(msg.timestamp)) : new Date(),
      });
    }
  });
}

export async function appendChatMessage(userId: string, message: AnyRecord): Promise<void> {
  const db = getDb();
  await db.insert(schema.chatMessages).values({
    id: String(message.id ?? crypto.randomUUID()),
    userId,
    role: String(message.role ?? 'assistant'),
    content: String(message.content ?? ''),
    context: message.context ? String(message.context) : null,
    timestamp: message.timestamp ? new Date(Number(message.timestamp)) : new Date(),
  });
}

export async function addAuditEvent(
  userId: string,
  action: string,
  details: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  await db.insert(schema.auditEvents).values({
    id: crypto.randomUUID(),
    userId,
    action,
    details,
    metadata: metadata ?? null,
    timestamp: new Date(),
  });
}

export async function getAuditEvents(userId: string, limit = 100, offset = 0): Promise<AnyRecord[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.auditEvents)
    .where(eq(schema.auditEvents.userId, userId))
    .orderBy(desc(schema.auditEvents.timestamp))
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    action: row.action,
    details: row.details,
    metadata: row.metadata ?? undefined,
    timestamp: row.timestamp.toISOString(),
  }));
}

export async function getPortfolio(userId: string): Promise<PortfolioSnapshot> {
  await ensureUserState(userId);
  const db = getDb();
  const [portfolioRow] = await db
    .select()
    .from(schema.portfolios)
    .where(eq(schema.portfolios.userId, userId))
    .limit(1);

  const positionRows = await db
    .select()
    .from(schema.positions)
    .where(eq(schema.positions.userId, userId));

  const orderRows = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.userId, userId));

  const tradeRows = await db
    .select()
    .from(schema.trades)
    .where(eq(schema.trades.userId, userId))
    .orderBy(desc(schema.trades.executedAt));

  if (!portfolioRow) return DEFAULT_PORTFOLIO;

  return {
    virtualBalance: toNumber(portfolioRow.virtualBalance, 100000),
    totalDeposited: toNumber(portfolioRow.totalDeposited, 100000),
    positions: positionRows.map((row) => row.data),
    orders: orderRows.map((row) => row.data),
    tradeHistory: tradeRows.map((row) => row.data),
    balanceHistory: Array.isArray(portfolioRow.balanceHistory) ? (portfolioRow.balanceHistory as unknown[]) : [],
  };
}

export async function savePortfolio(
  userId: string,
  payload: {
    virtualBalance: number;
    totalDeposited: number;
    positions: unknown[];
    orders: unknown[];
    tradeHistory: unknown[];
    balanceHistory: unknown[];
  }
): Promise<void> {
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx
      .insert(schema.portfolios)
      .values({
        userId,
        virtualBalance: String(payload.virtualBalance),
        totalDeposited: String(payload.totalDeposited),
        balanceHistory: payload.balanceHistory,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.portfolios.userId,
        set: {
          virtualBalance: String(payload.virtualBalance),
          totalDeposited: String(payload.totalDeposited),
          balanceHistory: payload.balanceHistory,
          updatedAt: new Date(),
        },
      });

    await tx.delete(schema.positions).where(eq(schema.positions.userId, userId));
    await tx.delete(schema.orders).where(eq(schema.orders.userId, userId));
    await tx.delete(schema.trades).where(eq(schema.trades.userId, userId));

    for (const rawPosition of payload.positions) {
      const pos = (rawPosition as AnyRecord) ?? {};
      await tx.insert(schema.positions).values({
        id: String(pos.id ?? crypto.randomUUID()),
        userId,
        symbol: String(pos.symbol ?? ''),
        assetType: String(pos.assetType ?? 'crypto'),
        side: String(pos.side ?? 'long'),
        data: pos,
        openedAt: pos.openedAt ? new Date(String(pos.openedAt)) : new Date(),
        updatedAt: new Date(),
      });
    }

    for (const rawOrder of payload.orders) {
      const order = (rawOrder as AnyRecord) ?? {};
      await tx.insert(schema.orders).values({
        id: String(order.id ?? crypto.randomUUID()),
        userId,
        symbol: String(order.symbol ?? ''),
        assetType: String(order.assetType ?? 'crypto'),
        status: String(order.status ?? 'pending'),
        createdAt: order.createdAt ? new Date(String(order.createdAt)) : new Date(),
        data: order,
      });
    }

    for (const rawTrade of payload.tradeHistory) {
      const trade = (rawTrade as AnyRecord) ?? {};
      await tx.insert(schema.trades).values({
        id: String(trade.id ?? crypto.randomUUID()),
        userId,
        symbol: String(trade.symbol ?? ''),
        assetType: String(trade.assetType ?? 'crypto'),
        executedAt: trade.executedAt ? new Date(String(trade.executedAt)) : new Date(),
        data: trade,
      });
    }
  });
}

export async function importFullState(userId: string, payload: Record<string, unknown>, dryRun: boolean) {
  const settings = (payload.settings as AnyRecord | undefined) ?? DEFAULT_SETTINGS;
  const watchlists = Array.isArray(payload.watchlists) ? (payload.watchlists as AnyRecord[]) : [];
  const alerts = Array.isArray(payload.alerts) ? (payload.alerts as AnyRecord[]) : [];
  const messages = Array.isArray(payload.chatMessages) ? (payload.chatMessages as AnyRecord[]) : [];
  const audit = Array.isArray(payload.auditEvents) ? (payload.auditEvents as AnyRecord[]) : [];
  const portfolio = (payload.portfolio as Record<string, unknown> | undefined) ?? DEFAULT_PORTFOLIO;

  const report = {
    dryRun,
    imported: {
      settings: 1,
      watchlists: watchlists.length,
      alerts: alerts.length,
      chatMessages: messages.length,
      auditEvents: audit.length,
      positions: Array.isArray(portfolio.positions) ? portfolio.positions.length : 0,
      orders: Array.isArray(portfolio.orders) ? portfolio.orders.length : 0,
      trades: Array.isArray(portfolio.tradeHistory) ? portfolio.tradeHistory.length : 0,
    },
  };

  if (dryRun) return report;

  await saveSettings(userId, settings);
  await saveWatchlists(userId, watchlists);
  await saveAlerts(userId, alerts);
  await saveChatMessages(userId, messages);

  await savePortfolio(userId, {
    virtualBalance: toNumber(portfolio.virtualBalance as string | number, 100000),
    totalDeposited: toNumber(portfolio.totalDeposited as string | number, 100000),
    positions: Array.isArray(portfolio.positions) ? (portfolio.positions as AnyRecord[]) : [],
    orders: Array.isArray(portfolio.orders) ? (portfolio.orders as AnyRecord[]) : [],
    tradeHistory: Array.isArray(portfolio.tradeHistory) ? (portfolio.tradeHistory as AnyRecord[]) : [],
    balanceHistory: Array.isArray(portfolio.balanceHistory) ? (portfolio.balanceHistory as AnyRecord[]) : [],
  });

  for (const event of audit) {
    await addAuditEvent(
      userId,
      String(event.action ?? 'DATA_IMPORTED'),
      String(event.details ?? 'Imported from V1 local storage'),
      (event.metadata as Record<string, unknown>) ?? undefined
    );
  }

  await addAuditEvent(userId, 'DATA_IMPORTED', 'V1 local data imported to backend', report.imported);

  return report;
}
