// ===== Core Domain Types =====

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface AuthResult {
  user: User;
  token: string;
}

// ===== Market Types =====

export type AssetType = 'crypto' | 'forex';

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  marketCap?: number;
  image?: string;
  sparkline?: number[];
  lastUpdated: string;
}

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ForexPair {
  id: string;
  symbol: string;
  name: string;
  base: string;
  quote: string;
  rate: number;
  change24h: number;
  changePercent24h: number;
}

// ===== Trading Types =====

export type OrderType = 'market' | 'limit' | 'stop';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'expired';
export type PositionSide = 'long' | 'short';

export interface Position {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  openedAt: string;
  stopLoss?: number;
  takeProfit?: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export interface Order {
  id: string;
  symbol: string;
  assetType: AssetType;
  type: OrderType;
  side: OrderSide;
  quantity: number;
  price?: number;
  status: OrderStatus;
  statusReason?: string;
  createdAt: string;
  filledAt?: string;
  filledPrice?: number;
}

export interface TradeRecord {
  id: string;
  userId: string;
  symbol: string;
  assetType: AssetType;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price: number;
  total: number;
  fee: number;
  pnl?: number;
  pnlPercent?: number;
  executedAt: string;
  notes?: string;
  aiAnalysis?: {
    signal: string;
    confidence: number;
    source: 'gemini' | 'rule-based';
  };
}

export interface Portfolio {
  userId: string;
  virtualBalance: number;
  totalDeposited: number;
  positions: Position[];
  orders: Order[];
  balanceHistory: BalanceSnapshot[];
}

export interface BalanceSnapshot {
  timestamp: string;
  totalValue: number;
  cashBalance: number;
}

// ===== AI Analysis Types =====

export interface AiAnalysisResult {
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
}

export interface SentimentResult {
  overallSentiment: number;
  sentimentLabel: 'very_bearish' | 'bearish' | 'neutral' | 'bullish' | 'very_bullish';
  keyThemes: string[];
  impactAssessment: 'low' | 'medium' | 'high';
  reasoning: string;
  source: 'gemini' | 'keyword' | 'none';
}

export interface MarketSummary {
  summary: string;
  marketMood: 'risk-on' | 'risk-off' | 'mixed' | 'uncertain';
  keyEvent: string;
  outlook: string;
  source: 'gemini' | 'rule-based';
  generatedAt: string;
}

export interface TradeEvalResult {
  riskRating: 'low' | 'medium' | 'high' | 'very_high';
  positionSizeAssessment: 'appropriate' | 'too_large' | 'too_small';
  diversificationImpact: string;
  suggestions: string[];
  warning?: string;
  source?: 'gemini' | 'rule-based' | 'backend';
  generatedAt?: string;
}

export interface AiOpportunity {
  symbol: string;
  bias: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  reason: string;
}

export interface AiDashboardInsights {
  summary: string;
  marketMood: 'risk-on' | 'risk-off' | 'mixed' | 'uncertain';
  keyDrivers: string[];
  portfolioActions: string[];
  riskFlags: string[];
  opportunities: AiOpportunity[];
  source: 'gemini' | 'rule-based' | 'backend';
  generatedAt: string;
}

export interface AiNewsBrief {
  headline: string;
  summary: string;
  themes: string[];
  actionableIdeas: AiOpportunity[];
  riskLevel: 'low' | 'medium' | 'high';
  sentimentScore: number;
  source: 'gemini' | 'keyword' | 'backend';
  generatedAt: string;
}

export interface ChatAssistantResponse {
  reply: string;
  followUps: string[];
  riskLevel: 'low' | 'medium' | 'high';
  source: 'gemini' | 'rule-based' | 'backend';
  generatedAt: string;
}

export type AiSentimentResult = SentimentResult;

// ===== News Types =====

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  category: 'crypto' | 'forex' | 'economy' | 'general';
  sentiment?: number;
  sentimentSource?: 'gemini' | 'keyword' | 'none';
  relatedAssets?: string[];
}

// ===== Watchlist & Alert Types =====

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  symbols: WatchlistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistItem {
  symbol: string;
  assetType: AssetType;
  addedAt: string;
  sortOrder: number;
}

export interface Alert {
  id: string;
  userId: string;
  symbol: string;
  assetType: AssetType;
  type: 'price_above' | 'price_below' | 'percent_change';
  targetValue: number;
  currentValue?: number;
  isTriggered: boolean;
  isActive: boolean;
  createdAt: string;
  triggeredAt?: string;
  notificationSent: boolean;
}

// ===== Calendar Types =====

export interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  date: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
  previous?: string;
  forecast?: string;
  actual?: string;
}

// ===== Audit Types =====

export type AuditAction =
  | 'LOGIN' | 'LOGOUT' | 'REGISTER'
  | 'TRADE_EXECUTED' | 'ORDER_PLACED' | 'ORDER_CANCELLED'
  | 'ALERT_CREATED' | 'ALERT_TRIGGERED'
  | 'WATCHLIST_MODIFIED' | 'SETTINGS_CHANGED'
  | 'RISK_GUARDRAIL_BLOCKED' | 'RISK_GUARDRAIL_WARNING'
  | 'PORTFOLIO_RESET' | 'PASSWORD_CHANGED'
  | 'API_KEY_ADDED' | 'API_KEY_REMOVED'
  | 'AI_ANALYSIS_REQUESTED' | 'DATA_EXPORTED';

export interface AuditEntry {
  id: string;
  userId: string;
  action: AuditAction;
  details: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// ===== Settings Types =====

export interface ApiKeyConfig {
  key: string;
  addedAt: string;
  lastValidated: string;
  isValid: boolean;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  apiKeys: {
    gemini?: ApiKeyConfig;
    newsdata?: ApiKeyConfig;
  };
  chartPreferences: {
    type: 'candlestick' | 'line' | 'area';
    indicators: string[];
    timeframe: string;
    showVolume: boolean;
  };
  notifications: {
    priceAlerts: boolean;
    signalAlerts: boolean;
    soundEnabled: boolean;
    browserNotifications: boolean;
  };
  trading: {
    defaultOrderType: OrderType;
    confirmBeforeTrade: boolean;
    defaultStopLossPercent: number;
    defaultTakeProfitPercent: number;
    enableRiskGuardrails: boolean;
    maxPositionSizePercent: number;
    maxDailyLossPercent: number;
    maxOpenPositions: number;
    warnOnConcentration: boolean;
  };
  ai: {
    enableAiAnalysis: boolean;
    autoAnalyzeOnView: boolean;
    showAiDisclaimer: boolean;
  };
}

// ===== Service Interfaces (Backend-Ready Contracts) =====

export interface IAuthService {
  register(email: string, password: string, username: string): Promise<AuthResult>;
  login(email: string, password: string): Promise<AuthResult>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
}

export interface IMarketService {
  getCryptoAssets(): Promise<Asset[]>;
  getForexPairs(): Promise<ForexPair[]>;
  getAssetDetails(id: string, assetType: AssetType): Promise<Asset | null>;
  getOHLCV(id: string, assetType: AssetType, days: number): Promise<OHLCV[]>;
  searchAssets(query: string): Promise<Asset[]>;
}

export interface ITradingService {
  placeOrder(order: Omit<Order, 'id' | 'status' | 'createdAt' | 'filledAt' | 'filledPrice'>): Promise<Order>;
  cancelOrder(orderId: string): Promise<void>;
  closePosition(positionId: string, currentPrice: number): Promise<TradeRecord>;
  getPortfolio(userId: string): Promise<Portfolio>;
  getTradeHistory(userId: string): Promise<TradeRecord[]>;
}

export interface INewsService {
  getNews(category?: string): Promise<NewsArticle[]>;
  getNewsByAsset(assetId: string): Promise<NewsArticle[]>;
}

export interface IAnalysisService {
  getMarketAnalysis(asset: string, context: Record<string, unknown>): Promise<AiAnalysisResult>;
  getSentimentAnalysis(asset: string, headlines: string[]): Promise<SentimentResult>;
  evaluateTrade(tradeDetails: Record<string, unknown>): Promise<TradeEvalResult>;
  getMarketSummary(marketData: Record<string, unknown>): Promise<MarketSummary>;
  isAvailable(): boolean;
  getSource(): 'gemini' | 'rule-based' | 'backend';
}
