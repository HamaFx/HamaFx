import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getEnv } from './env.js';
import { getAlerts, getPortfolio, getSettings, getWatchlists } from './state.js';
import { getCryptoMarkets, getForexRates } from './market.js';
import { getNews } from './news.js';
import { withRedisCache } from './redis.js';

type JsonRecord = Record<string, unknown>;

type MarketMood = 'risk-on' | 'risk-off' | 'mixed' | 'uncertain';
type RiskLevel = 'low' | 'medium' | 'high';
type OpportunityBias = 'bullish' | 'bearish' | 'neutral';
type AiProvider = 'gemini' | 'groq' | 'scitely';

export type AiOpportunity = {
  symbol: string;
  bias: OpportunityBias;
  confidence: number;
  reason: string;
};

export type AiDashboardInsights = {
  summary: string;
  marketMood: MarketMood;
  keyDrivers: string[];
  portfolioActions: string[];
  riskFlags: string[];
  opportunities: AiOpportunity[];
  generatedAt: string;
  source: 'gemini' | 'rule-based';
};

export type AiChatReply = {
  reply: string;
  followUps: string[];
  riskLevel: RiskLevel;
  generatedAt: string;
  source: 'gemini' | 'rule-based';
};

export type AiAssetAnalysis = {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string[];
  riskFactors: string[];
  supportLevel?: number;
  resistanceLevel?: number;
  suggestedStopLoss?: number;
  suggestedTakeProfit?: number;
  timeHorizon: 'short-term' | 'medium-term' | 'long-term';
  summary: string;
  source: 'gemini' | 'rule-based';
  generatedAt: string;
};

export type AiSentiment = {
  overallSentiment: number;
  sentimentLabel: 'very_bearish' | 'bearish' | 'neutral' | 'bullish' | 'very_bullish';
  keyThemes: string[];
  impactAssessment: 'low' | 'medium' | 'high';
  reasoning: string;
  source: 'gemini' | 'keyword' | 'none';
};

export type AiTradeEvaluation = {
  riskRating: 'low' | 'medium' | 'high' | 'very_high';
  positionSizeAssessment: 'appropriate' | 'too_large' | 'too_small';
  diversificationImpact: string;
  suggestions: string[];
  warning?: string;
  source: 'gemini' | 'rule-based';
  generatedAt: string;
};

export type AiNewsBrief = {
  headline: string;
  summary: string;
  themes: string[];
  actionableIdeas: AiOpportunity[];
  riskLevel: RiskLevel;
  sentimentScore: number;
  generatedAt: string;
  source: 'gemini' | 'keyword';
};

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const SCITELY_CHAT_URL = 'https://api.scitely.com/v1/chat/completions';
const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_SCITELY_MODEL = 'qwen3-32b';

const sentimentSchema = z.object({
  overallSentiment: z.number().min(-100).max(100),
  sentimentLabel: z.enum(['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish']),
  keyThemes: z.array(z.string().min(2)).max(6),
  impactAssessment: z.enum(['low', 'medium', 'high']),
  reasoning: z.string().min(6).max(420),
});

const analysisSchema = z.object({
  signal: z.enum(['BUY', 'SELL', 'HOLD']),
  confidence: z.number().min(0).max(100),
  reasoning: z.array(z.string().min(2)).max(6),
  riskFactors: z.array(z.string().min(2)).max(6),
  supportLevel: z.number().optional(),
  resistanceLevel: z.number().optional(),
  suggestedStopLoss: z.number().optional(),
  suggestedTakeProfit: z.number().optional(),
  timeHorizon: z.enum(['short-term', 'medium-term', 'long-term']),
  summary: z.string().min(8).max(420),
});

const chatSchema = z.object({
  reply: z.string().min(4).max(2000),
  followUps: z.array(z.string().min(2).max(120)).max(4),
  riskLevel: z.enum(['low', 'medium', 'high']),
});

const insightsSchema = z.object({
  summary: z.string().min(8).max(420),
  marketMood: z.enum(['risk-on', 'risk-off', 'mixed', 'uncertain']),
  keyDrivers: z.array(z.string().min(2)).max(5),
  portfolioActions: z.array(z.string().min(2)).max(5),
  riskFlags: z.array(z.string().min(2)).max(4),
  opportunities: z.array(
    z.object({
      symbol: z.string().min(1).max(24),
      bias: z.enum(['bullish', 'bearish', 'neutral']),
      confidence: z.number().min(0).max(100),
      reason: z.string().min(3).max(160),
    })
  ).max(6),
});

const tradeEvalSchema = z.object({
  riskRating: z.enum(['low', 'medium', 'high', 'very_high']),
  positionSizeAssessment: z.enum(['appropriate', 'too_large', 'too_small']),
  diversificationImpact: z.string().min(4).max(240),
  suggestions: z.array(z.string().min(3)).max(5),
  warning: z.string().max(220).optional(),
});

const newsBriefSchema = z.object({
  headline: z.string().min(6).max(140),
  summary: z.string().min(12).max(520),
  themes: z.array(z.string().min(2)).max(6),
  actionableIdeas: z.array(
    z.object({
      symbol: z.string().min(1).max(24),
      bias: z.enum(['bullish', 'bearish', 'neutral']),
      confidence: z.number().min(0).max(100),
      reason: z.string().min(3).max(160),
    })
  ).max(6),
  riskLevel: z.enum(['low', 'medium', 'high']),
  sentimentScore: z.number().min(-100).max(100),
});

function getGeminiKey(): string | null {
  try {
    return getEnv().GEMINI_API_KEY || null;
  } catch {
    return null;
  }
}

export function isAiProviderConfigured(): boolean {
  try {
    const env = getEnv();
    return Boolean(env.GEMINI_API_KEY || env.GROQ_API_KEY || env.SCITELY_API_KEY);
  } catch {
    return false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function truncate(value: string, max = 220): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function hashKey(input: unknown): string {
  const raw = typeof input === 'string' ? input : JSON.stringify(input);
  return createHash('sha1').update(raw).digest('hex');
}

function parseJsonBlock<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const payload = fenced ? fenced[1].trim() : text.trim();
  return JSON.parse(payload) as T;
}

function getProviderOrder(): AiProvider[] {
  const env = getEnv();
  const available = ([
    env.GEMINI_API_KEY ? 'gemini' : null,
    env.GROQ_API_KEY ? 'groq' : null,
    env.SCITELY_API_KEY ? 'scitely' : null,
  ].filter(Boolean) as AiProvider[]);

  if (available.length === 0) return [];

  const preferred = env.AI_PROVIDER ?? 'auto';
  if (preferred === 'auto') return available;
  if (!available.includes(preferred)) return available;
  return [preferred, ...available.filter((provider) => provider !== preferred)];
}

function getProviderErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const obj = payload as JsonRecord;
  const error = obj.error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const nested = error as JsonRecord;
    if (typeof nested.message === 'string') return nested.message;
    if (typeof nested.code === 'string') return nested.code;
  }
  if (typeof obj.message === 'string') return obj.message;
  return fallback;
}

async function callGeminiRaw(params: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  const key = getGeminiKey();
  if (!key) throw new Error('Gemini API key is not configured');

  const response = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: params.systemPrompt }] },
      contents: [{ parts: [{ text: params.userPrompt }] }],
      generationConfig: {
        temperature: params.temperature ?? 0.35,
        topP: 0.9,
        maxOutputTokens: params.maxOutputTokens ?? 1024,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = getProviderErrorMessage(payload, `Gemini API failed (${response.status})`);
    throw new Error(`gemini: ${message}`);
  }

  const candidate = ((payload as JsonRecord).candidates as JsonRecord[] | undefined)?.[0];
  const content = (candidate?.content as JsonRecord | undefined);
  const parts = (content?.parts as JsonRecord[] | undefined) ?? [];
  const text = asString(parts[0]?.text);
  if (!text) throw new Error('gemini: provider returned an empty response');
  return text;
}

async function callOpenAiCompatRaw(
  provider: 'groq' | 'scitely',
  params: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxOutputTokens?: number;
  }
): Promise<string> {
  const env = getEnv();
  const apiKey = provider === 'groq' ? env.GROQ_API_KEY : env.SCITELY_API_KEY;
  if (!apiKey) throw new Error(`${provider}: API key is not configured`);

  const model = provider === 'groq'
    ? (env.GROQ_MODEL || DEFAULT_GROQ_MODEL)
    : (env.SCITELY_MODEL || DEFAULT_SCITELY_MODEL);
  const endpoint = provider === 'groq' ? GROQ_CHAT_URL : SCITELY_CHAT_URL;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      temperature: params.temperature ?? 0.35,
      max_tokens: params.maxOutputTokens ?? 1024,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = getProviderErrorMessage(payload, `${provider} API failed (${response.status})`);
    throw new Error(`${provider}: ${message}`);
  }

  const text = asString((((payload as JsonRecord).choices as JsonRecord[] | undefined)?.[0]?.message as JsonRecord | undefined)?.content);
  if (!text) throw new Error(`${provider}: provider returned an empty response`);
  return text;
}

async function callGeminiJson<T>(params: {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<T> {
  const providers = getProviderOrder();
  if (providers.length === 0) {
    throw new Error('AI provider is not configured (set GEMINI_API_KEY or GROQ_API_KEY or SCITELY_API_KEY)');
  }

  let lastError: Error | null = null;
  for (const provider of providers) {
    try {
      const text = provider === 'gemini'
        ? await callGeminiRaw(params)
        : await callOpenAiCompatRaw(provider, params);
      const parsed = parseJsonBlock<unknown>(text);
      return params.schema.parse(parsed);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown AI provider failure');
    }
  }

  throw lastError ?? new Error('AI provider request failed');
}

function labelSentiment(score: number): AiSentiment['sentimentLabel'] {
  if (score >= 60) return 'very_bullish';
  if (score >= 20) return 'bullish';
  if (score <= -60) return 'very_bearish';
  if (score <= -20) return 'bearish';
  return 'neutral';
}

function keywordSentimentScore(lines: string[]): number {
  const positiveWords = [
    'surge', 'rally', 'gain', 'bull', 'soar', 'jump', 'rise', 'record', 'growth', 'inflow', 'beat', 'upgrade', 'strong',
  ];
  const negativeWords = [
    'crash', 'drop', 'fall', 'bear', 'plunge', 'decline', 'selloff', 'hack', 'ban', 'downgrade', 'weak', 'risk', 'fear',
  ];

  let score = 0;
  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const word of positiveWords) {
      if (lower.includes(word)) score += 12;
    }
    for (const word of negativeWords) {
      if (lower.includes(word)) score -= 12;
    }
  }

  return clamp(score, -100, 100);
}

type AiContext = {
  portfolio: {
    virtualBalance: number;
    totalDeposited: number;
    positionsCount: number;
    openOrdersCount: number;
    tradesCount: number;
    notionalExposure: number;
    symbols: string[];
  };
  riskProfile: {
    enableRiskGuardrails: boolean;
    maxPositionSizePercent: number;
    maxDailyLossPercent: number;
    maxOpenPositions: number;
  };
  watchlist: {
    lists: number;
    symbols: string[];
  };
  alerts: {
    active: number;
    triggered: number;
  };
  market: {
    topCrypto: Array<{ symbol: string; price: number; change24h: number }>;
    forex: Array<{ pair: string; rate: number }>;
  };
  news: Array<{ title: string; source: string; category: string }>;
};

async function buildAiContext(userId: string): Promise<AiContext> {
  const [portfolio, settings, watchlists, alerts, cryptoResult, forexResult, newsResult] = await Promise.all([
    getPortfolio(userId),
    getSettings(userId),
    getWatchlists(userId),
    getAlerts(userId),
    getCryptoMarkets(10).catch(() => []),
    getForexRates().catch(() => ({} as Record<string, number>)),
    getNews('all').catch(() => []),
  ]);

  const positions = Array.isArray(portfolio.positions) ? portfolio.positions : [];
  const openOrders = Array.isArray(portfolio.orders) ? portfolio.orders : [];
  const trades = Array.isArray(portfolio.tradeHistory) ? portfolio.tradeHistory : [];
  const symbols = positions
    .map((item) => asString((item as JsonRecord).symbol))
    .filter(Boolean)
    .slice(0, 12);
  const notionalExposure = positions.reduce<number>((sum, item) => {
    const row = item as JsonRecord;
    return sum + asNumber(row.entryPrice) * asNumber(row.quantity);
  }, 0);

  const settingsTrading = ((settings as JsonRecord).trading as JsonRecord | undefined) ?? {};
  const watchlistSymbols = watchlists
    .flatMap((list) => {
      const symbolsList = (list.symbols as JsonRecord[] | undefined) ?? [];
      return symbolsList.map((item) => asString(item.symbol)).filter(Boolean);
    })
    .slice(0, 20);

  const normalizedCrypto = (Array.isArray(cryptoResult) ? cryptoResult : [])
    .slice(0, 6)
    .map((item) => {
      const row = item as JsonRecord;
      const symbol = asString(row.symbol).toUpperCase() || asString(row.baseSymbol).toUpperCase();
      const price = asNumber(row.current_price, asNumber(row.priceUsd));
      const change24h = asNumber(row.price_change_percentage_24h, asNumber(row.changePercent24Hr));
      return { symbol, price, change24h };
    })
    .filter((item) => item.symbol);

  const forexKeys = Object.entries(forexResult as Record<string, number>)
    .filter(([code]) => ['EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'].includes(code))
    .slice(0, 6)
    .map(([quote, rate]) => ({ pair: `USD/${quote}`, rate: asNumber(rate, 0) }));

  const normalizedNews = (Array.isArray(newsResult) ? newsResult : [])
    .slice(0, 8)
    .map((item) => ({
      title: truncate(asString((item as JsonRecord).title), 120),
      source: truncate(asString((item as JsonRecord).source), 30),
      category: asString((item as JsonRecord).category, 'general'),
    }))
    .filter((item) => item.title);

  const activeAlerts = alerts.filter((item) => Boolean((item as JsonRecord).isActive) && !Boolean((item as JsonRecord).isTriggered));
  const triggeredAlerts = alerts.filter((item) => Boolean((item as JsonRecord).isTriggered));

  return {
    portfolio: {
      virtualBalance: asNumber(portfolio.virtualBalance, 100000),
      totalDeposited: asNumber(portfolio.totalDeposited, 100000),
      positionsCount: positions.length,
      openOrdersCount: openOrders.length,
      tradesCount: trades.length,
      notionalExposure,
      symbols,
    },
    riskProfile: {
      enableRiskGuardrails: Boolean(settingsTrading.enableRiskGuardrails ?? true),
      maxPositionSizePercent: asNumber(settingsTrading.maxPositionSizePercent, 25),
      maxDailyLossPercent: asNumber(settingsTrading.maxDailyLossPercent, 5),
      maxOpenPositions: asNumber(settingsTrading.maxOpenPositions, 8),
    },
    watchlist: {
      lists: watchlists.length,
      symbols: [...new Set(watchlistSymbols)].slice(0, 16),
    },
    alerts: {
      active: activeAlerts.length,
      triggered: triggeredAlerts.length,
    },
    market: {
      topCrypto: normalizedCrypto,
      forex: forexKeys,
    },
    news: normalizedNews,
  };
}

function fallbackInsights(context: AiContext): AiDashboardInsights {
  const avgChange = context.market.topCrypto.length
    ? context.market.topCrypto.reduce((sum, item) => sum + item.change24h, 0) / context.market.topCrypto.length
    : 0;

  const marketMood: MarketMood = avgChange >= 2 ? 'risk-on' : avgChange <= -2 ? 'risk-off' : 'mixed';
  const moodLabel = marketMood === 'risk-on' ? 'risk appetite is improving' : marketMood === 'risk-off' ? 'risk appetite is fragile' : 'market signals are mixed';

  const opportunities: AiOpportunity[] = context.market.topCrypto
    .slice(0, 3)
    .map((item) => ({
      symbol: item.symbol,
      bias: item.change24h > 1.5 ? 'bullish' : item.change24h < -1.5 ? 'bearish' : 'neutral',
      confidence: clamp(55 + Math.abs(item.change24h) * 8, 45, 86),
      reason: `${item.symbol} moved ${item.change24h >= 0 ? '+' : ''}${item.change24h.toFixed(1)}% in 24h`,
    }));

  const riskFlags = [
    context.portfolio.positionsCount > context.riskProfile.maxOpenPositions
      ? `Open positions exceed cap (${context.portfolio.positionsCount}/${context.riskProfile.maxOpenPositions}).`
      : '',
    context.alerts.triggered > 0 ? `${context.alerts.triggered} alert(s) recently triggered.` : '',
    context.portfolio.notionalExposure > context.portfolio.totalDeposited * 0.6
      ? 'Portfolio concentration is elevated relative to equity.'
      : '',
  ].filter(Boolean);

  const keyDrivers = [
    `Top crypto basket average change: ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%.`,
    context.news[0] ? `News flow leader: ${context.news[0].title}` : 'Limited high-signal news in cache.',
    `Watchlist tracking ${context.watchlist.symbols.length} symbols.`,
  ];

  const portfolioActions = [
    context.portfolio.positionsCount === 0
      ? 'No open positions: start with one small paper trade and define risk before entry.'
      : 'Review open positions and trim any that exceed your risk policy.',
    'Set alerts for invalidation levels before adding new exposure.',
    'Use staged entries instead of single large fills in volatile markets.',
  ];

  return {
    summary: `AI fallback: ${moodLabel}. Focus on disciplined sizing and confirmation-driven entries.`,
    marketMood,
    keyDrivers: keyDrivers.slice(0, 4),
    portfolioActions: portfolioActions.slice(0, 4),
    riskFlags: riskFlags.slice(0, 4),
    opportunities,
    generatedAt: new Date().toISOString(),
    source: 'rule-based',
  };
}

export async function getAiDashboardInsights(userId: string): Promise<AiDashboardInsights> {
  const cacheKey = `ai:insights:${userId}`;
  return withRedisCache(cacheKey, 90, async () => {
    const context = await buildAiContext(userId);

    try {
      const payload = await callGeminiJson({
        schema: insightsSchema,
        systemPrompt:
          'You are HamaFX institutional-grade AI strategist. Return ONLY valid JSON. Keep risk-first language. Never promise returns. Mention paper-trading context where relevant.',
        userPrompt: `Generate a concise dashboard intelligence snapshot using this context:\n${JSON.stringify(context)}\n\nReturn JSON with summary, marketMood, keyDrivers, portfolioActions, riskFlags, opportunities.`,
        temperature: 0.25,
        maxOutputTokens: 900,
      });

      return {
        ...payload,
        generatedAt: new Date().toISOString(),
        source: 'gemini',
      };
    } catch {
      return fallbackInsights(context);
    }
  });
}

function fallbackChatResponse(message: string, context: AiContext): AiChatReply {
  const lower = message.toLowerCase();
  const start = context.market.topCrypto[0];

  if (lower.includes('portfolio') || lower.includes('risk')) {
    return {
      reply: `Portfolio snapshot: ${context.portfolio.positionsCount} open position(s), ${context.portfolio.openOrdersCount} open order(s), and $${context.portfolio.virtualBalance.toFixed(2)} cash. Highest priority: keep each position under ${context.riskProfile.maxPositionSizePercent}% and protect downside with defined exits.`,
      followUps: ['Show my concentration risk', 'How should I size the next trade?', 'What risk level am I running now?'],
      riskLevel: 'medium',
      generatedAt: new Date().toISOString(),
      source: 'rule-based',
    };
  }

  return {
    reply: `Market pulse is ${context.market.topCrypto.length ? 'active' : 'limited-data'} right now. ${start ? `${start.symbol} is ${start.change24h >= 0 ? 'up' : 'down'} ${Math.abs(start.change24h).toFixed(1)}% in 24h.` : ''} Focus on setups with clear invalidation and avoid oversized entries.`,
    followUps: ['Give me top opportunities', 'Summarize today\'s risk events', 'Create a trade plan template'],
    riskLevel: 'medium',
    generatedAt: new Date().toISOString(),
    source: 'rule-based',
  };
}

export async function getAiChatReply(params: {
  userId: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<AiChatReply> {
  const context = await buildAiContext(params.userId);
  const history = Array.isArray(params.history) ? params.history.slice(-8) : [];

  try {
    const payload = await callGeminiJson({
      schema: chatSchema,
      systemPrompt:
        'You are HamaFX Copilot. Return ONLY JSON. Be concise, risk-first, educational, and grounded in provided portfolio/market context. Mention uncertainty when data is incomplete.',
      userPrompt: `Context:\n${JSON.stringify(context)}\n\nRecent history:\n${JSON.stringify(history)}\n\nUser message:\n${params.message}\n\nReturn JSON: reply, followUps (max 4), riskLevel.`,
      temperature: 0.45,
      maxOutputTokens: 1100,
    });

    return {
      ...payload,
      generatedAt: new Date().toISOString(),
      source: 'gemini',
    };
  } catch {
    return fallbackChatResponse(params.message, context);
  }
}

function fallbackAssetAnalysis(input: {
  assetSymbol: string;
  context: JsonRecord;
}): AiAssetAnalysis {
  const change = asNumber(input.context.change24h, 0);
  const signal: AiAssetAnalysis['signal'] = change >= 2.5 ? 'BUY' : change <= -2.5 ? 'SELL' : 'HOLD';
  const confidence = clamp(55 + Math.abs(change) * 9, 42, 86);

  return {
    signal,
    confidence,
    reasoning: [
      `${input.assetSymbol} moved ${change >= 0 ? '+' : ''}${change.toFixed(2)}% over 24h.`,
      'Momentum-only fallback used because AI provider was unavailable.',
      'Wait for confirmation before increasing size.',
    ],
    riskFactors: [
      'Short-term volatility can invalidate momentum quickly.',
      'Paper-trading simulation does not include real slippage conditions.',
    ],
    timeHorizon: 'short-term',
    summary: `${signal} bias under fallback model with strict risk controls advised.`,
    source: 'rule-based',
    generatedAt: new Date().toISOString(),
  };
}

export async function getAiAssetAnalysis(input: {
  assetName: string;
  assetSymbol: string;
  context: JsonRecord;
}): Promise<AiAssetAnalysis> {
  const cacheKey = `ai:analysis:${input.assetSymbol}:${hashKey(input.context)}`;

  return withRedisCache(cacheKey, 120, async () => {
    try {
      const payload = await callGeminiJson({
        schema: analysisSchema,
        systemPrompt:
          'You are a professional market analyst for HamaFX. Return ONLY JSON. Provide balanced reasoning and explicit risk factors. Never guarantee outcomes.',
        userPrompt: `Analyze ${input.assetName} (${input.assetSymbol}) with this market context:\n${JSON.stringify(input.context)}\n\nReturn JSON with signal, confidence, reasoning, riskFactors, supportLevel, resistanceLevel, suggestedStopLoss, suggestedTakeProfit, timeHorizon, summary.`,
        temperature: 0.28,
        maxOutputTokens: 1200,
      });

      return {
        ...payload,
        generatedAt: new Date().toISOString(),
        source: 'gemini',
      };
    } catch {
      return fallbackAssetAnalysis(input);
    }
  });
}

export async function getAiSentiment(input: {
  assetSymbol: string;
  headlines: string[];
}): Promise<AiSentiment> {
  if (!input.headlines.length) {
    return {
      overallSentiment: 0,
      sentimentLabel: 'neutral',
      keyThemes: [],
      impactAssessment: 'low',
      reasoning: 'No headlines available for sentiment analysis.',
      source: 'none',
    };
  }

  const cacheKey = `ai:sentiment:${input.assetSymbol}:${hashKey(input.headlines.slice(0, 20))}`;

  return withRedisCache(cacheKey, 180, async () => {
    try {
      const payload = await callGeminiJson({
        schema: sentimentSchema,
        systemPrompt:
          'You are a financial sentiment analyst. Return ONLY JSON. Base conclusions on headline tone and macro implications; keep it concise.',
        userPrompt: `Asset: ${input.assetSymbol}\nHeadlines:\n${input.headlines.slice(0, 16).map((item, idx) => `${idx + 1}. ${item}`).join('\n')}\n\nReturn JSON with overallSentiment (-100 to 100), sentimentLabel, keyThemes, impactAssessment, reasoning.`,
        temperature: 0.3,
        maxOutputTokens: 900,
      });

      return {
        ...payload,
        source: 'gemini',
      };
    } catch {
      const score = keywordSentimentScore(input.headlines);
      return {
        overallSentiment: score,
        sentimentLabel: labelSentiment(score),
        keyThemes: ['Headline momentum', 'Risk sentiment'],
        impactAssessment: Math.abs(score) > 55 ? 'high' : Math.abs(score) > 25 ? 'medium' : 'low',
        reasoning: 'Keyword-based fallback sentiment was used because AI provider was unavailable.',
        source: 'keyword',
      };
    }
  });
}

export async function getAiTradeEvaluation(input: {
  side: string;
  symbol: string;
  quantity: number;
  price: number;
  portfolioValue: number;
  assetType: string;
}): Promise<AiTradeEvaluation> {
  const cacheKey = `ai:trade-eval:${input.symbol}:${input.side}:${hashKey({
    q: input.quantity,
    p: input.price,
    v: input.portfolioValue,
    a: input.assetType,
  })}`;

  return withRedisCache(cacheKey, 90, async () => {
    try {
      const payload = await callGeminiJson({
        schema: tradeEvalSchema,
        systemPrompt:
          'You are a trading risk manager. Return ONLY JSON. Evaluate proposed paper trade with strict position sizing and drawdown awareness.',
        userPrompt: `Evaluate this trade:\n${JSON.stringify(input)}\nPositionPercent=${((input.quantity * input.price) / Math.max(input.portfolioValue, 1) * 100).toFixed(2)}\n\nReturn JSON with riskRating, positionSizeAssessment, diversificationImpact, suggestions, warning(optional).`,
        temperature: 0.25,
        maxOutputTokens: 800,
      });

      return {
        ...payload,
        source: 'gemini',
        generatedAt: new Date().toISOString(),
      };
    } catch {
      const percent = (input.quantity * input.price) / Math.max(input.portfolioValue, 1);
      return {
        riskRating: percent > 0.35 ? 'very_high' : percent > 0.2 ? 'high' : percent > 0.1 ? 'medium' : 'low',
        positionSizeAssessment: percent > 0.25 ? 'too_large' : percent < 0.01 ? 'too_small' : 'appropriate',
        diversificationImpact: percent > 0.3
          ? 'This trade would heavily concentrate your portfolio.'
          : 'Diversification impact is moderate under current sizing.',
        suggestions: [
          'Define a stop-loss before execution.',
          'Keep single-position risk within your guardrail limits.',
          'Scale in across multiple entries when volatility is high.',
        ],
        warning: percent > 0.3 ? 'Position size is aggressive for a single trade.' : undefined,
        source: 'rule-based',
        generatedAt: new Date().toISOString(),
      };
    }
  });
}

export async function getAiNewsBrief(input: {
  userId: string;
  category?: string;
  limit?: number;
}): Promise<AiNewsBrief> {
  const category = input.category || 'all';
  const limit = clamp(input.limit ?? 14, 6, 30);
  const cacheKey = `ai:news-brief:${input.userId}:${category}:${limit}`;

  return withRedisCache(cacheKey, 120, async () => {
    const news = await getNews(category).catch(() => []);
    const normalizedNews = Array.isArray(news) ? news.slice(0, limit) : [];
    const headlines = normalizedNews.map((item) => asString((item as JsonRecord).title)).filter(Boolean);

    if (!headlines.length) {
      return {
        headline: 'No fresh headlines detected',
        summary: 'News feed is temporarily unavailable. Retry shortly or configure your provider key.',
        themes: ['Data unavailable'],
        actionableIdeas: [],
        riskLevel: 'medium',
        sentimentScore: 0,
        generatedAt: new Date().toISOString(),
        source: 'keyword',
      };
    }

    try {
      const payload = await callGeminiJson({
        schema: newsBriefSchema,
        systemPrompt:
          'You are a macro and market news strategist for HamaFX. Return ONLY JSON. Focus on practical trading implications and risk-first language.',
        userPrompt: `Category=${category}\nHeadlines:\n${headlines.map((item, idx) => `${idx + 1}. ${item}`).join('\n')}\n\nReturn JSON with headline, summary, themes, actionableIdeas (symbol,bias,confidence,reason), riskLevel, sentimentScore.`,
        temperature: 0.35,
        maxOutputTokens: 1050,
      });

      return {
        ...payload,
        generatedAt: new Date().toISOString(),
        source: 'gemini',
      };
    } catch {
      const sentimentScore = keywordSentimentScore(headlines);
      const first = headlines[0] || 'Market updates incoming';
      return {
        headline: truncate(first, 90),
        summary: 'Keyword-based briefing: monitor volatility and prioritize setups with clear invalidation levels.',
        themes: ['Momentum', 'Macro risk', 'Event-driven volatility'],
        actionableIdeas: [],
        riskLevel: Math.abs(sentimentScore) > 55 ? 'high' : 'medium',
        sentimentScore,
        generatedAt: new Date().toISOString(),
        source: 'keyword',
      };
    }
  });
}
