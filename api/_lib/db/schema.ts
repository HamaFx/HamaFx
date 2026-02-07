import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const nowTs = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    passwordSalt: text('password_salt').notNull(),
    createdAt: nowTs,
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    usersEmailUnique: uniqueIndex('users_email_unique').on(table.email),
  })
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    createdAt: nowTs,
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    sessionsUserIdx: index('sessions_user_idx').on(table.userId),
    sessionsTokenUnique: uniqueIndex('sessions_refresh_hash_unique').on(table.refreshTokenHash),
  })
);

export const portfolios = pgTable(
  'portfolios',
  {
    userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    virtualBalance: numeric('virtual_balance', { precision: 18, scale: 2 }).notNull().default('100000'),
    totalDeposited: numeric('total_deposited', { precision: 18, scale: 2 }).notNull().default('100000'),
    balanceHistory: jsonb('balance_history').$type<unknown[]>().notNull().default([]),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    portfoliosUserIdx: index('portfolios_user_idx').on(table.userId),
  })
);

export const positions = pgTable(
  'positions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    symbol: text('symbol').notNull(),
    assetType: text('asset_type').notNull(),
    side: text('side').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    positionsUserIdx: index('positions_user_idx').on(table.userId),
    positionsSymbolIdx: index('positions_symbol_idx').on(table.userId, table.symbol),
  })
);

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    symbol: text('symbol').notNull(),
    assetType: text('asset_type').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  },
  (table) => ({
    ordersUserIdx: index('orders_user_idx').on(table.userId),
    ordersCreatedIdx: index('orders_created_idx').on(table.userId, table.createdAt),
  })
);

export const trades = pgTable(
  'trades',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    symbol: text('symbol').notNull(),
    assetType: text('asset_type').notNull(),
    executedAt: timestamp('executed_at', { withTimezone: true }).defaultNow().notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  },
  (table) => ({
    tradesUserIdx: index('trades_user_idx').on(table.userId),
    tradesExecutedIdx: index('trades_executed_idx').on(table.userId, table.executedAt),
  })
);

export const watchlists = pgTable(
  'watchlists',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: nowTs,
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    watchlistsUserIdx: index('watchlists_user_idx').on(table.userId),
  })
);

export const watchlistItems = pgTable(
  'watchlist_items',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    watchlistId: text('watchlist_id').notNull().references(() => watchlists.id, { onDelete: 'cascade' }),
    symbol: text('symbol').notNull(),
    assetType: text('asset_type').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    addedAt: nowTs,
  },
  (table) => ({
    watchlistItemsUserIdx: index('watchlist_items_user_idx').on(table.userId),
    watchlistItemsWatchlistIdx: index('watchlist_items_watchlist_idx').on(table.watchlistId),
  })
);

export const alerts = pgTable(
  'alerts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    symbol: text('symbol').notNull(),
    assetType: text('asset_type').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    isTriggered: boolean('is_triggered').notNull().default(false),
    createdAt: nowTs,
    triggeredAt: timestamp('triggered_at', { withTimezone: true }),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  },
  (table) => ({
    alertsUserIdx: index('alerts_user_idx').on(table.userId),
  })
);

export const settings = pgTable(
  'settings',
  {
    userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    settingsUserIdx: index('settings_user_idx').on(table.userId),
  })
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    context: text('context'),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  },
  (table) => ({
    chatMessagesUserIdx: index('chat_messages_user_idx').on(table.userId),
    chatMessagesTimestampIdx: index('chat_messages_timestamp_idx').on(table.userId, table.timestamp),
  })
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    details: text('details').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  },
  (table) => ({
    auditEventsUserIdx: index('audit_events_user_idx').on(table.userId),
    auditEventsTimestampIdx: index('audit_events_timestamp_idx').on(table.userId, table.timestamp),
  })
);
