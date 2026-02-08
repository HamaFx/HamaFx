import type {
  AiAnalysisResult,
  AiChatMode,
  AiCommandCenter,
  AiDashboardInsights,
  AiNewsBrief,
  AiNewsIntel,
  AiRuntimeStatus,
  AiSentimentResult,
  ChatAssistantResponse,
  TradeEvalResult,
} from '@/types';
import { backendFetch } from './http';

export async function apiAiChat(payload: {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  mode?: AiChatMode;
}): Promise<ChatAssistantResponse> {
  return backendFetch<ChatAssistantResponse>('/api/v2/ai/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiAiInsights(): Promise<AiDashboardInsights> {
  return backendFetch<AiDashboardInsights>('/api/v2/ai/insights', { method: 'GET' });
}

export async function apiAiAssetAnalysis(payload: {
  assetName: string;
  assetSymbol: string;
  context: Record<string, unknown>;
}): Promise<AiAnalysisResult> {
  return backendFetch<AiAnalysisResult>('/api/v2/ai/analysis', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiAiSentiment(payload: {
  assetSymbol: string;
  headlines: string[];
}): Promise<AiSentimentResult> {
  return backendFetch<AiSentimentResult>('/api/v2/ai/sentiment', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiAiTradeEval(payload: {
  side: string;
  symbol: string;
  quantity: number;
  price: number;
  portfolioValue: number;
  assetType: string;
}): Promise<TradeEvalResult> {
  return backendFetch<TradeEvalResult>('/api/v2/ai/trade-eval', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiAiNewsBrief(params?: {
  category?: 'all' | 'crypto' | 'forex' | 'economy' | 'general';
  limit?: number;
}): Promise<AiNewsBrief> {
  const url = new URL('/api/v2/ai/news-brief', window.location.origin);
  if (params?.category) url.searchParams.set('category', params.category);
  if (typeof params?.limit === 'number') url.searchParams.set('limit', String(params.limit));

  return backendFetch<AiNewsBrief>(`${url.pathname}${url.search}`, { method: 'GET' });
}

export async function apiAiNewsIntel(params?: {
  category?: 'all' | 'crypto' | 'forex' | 'economy' | 'general';
  limit?: number;
}): Promise<AiNewsIntel> {
  const url = new URL('/api/v2/ai/news-intel', window.location.origin);
  if (params?.category) url.searchParams.set('category', params.category);
  if (typeof params?.limit === 'number') url.searchParams.set('limit', String(params.limit));

  return backendFetch<AiNewsIntel>(`${url.pathname}${url.search}`, { method: 'GET' });
}

export async function apiAiCommandCenter(): Promise<AiCommandCenter> {
  return backendFetch<AiCommandCenter>('/api/v2/ai/command-center', { method: 'GET' });
}

export async function apiAiStatus(): Promise<AiRuntimeStatus> {
  return backendFetch<AiRuntimeStatus>('/api/v2/ai/status', { method: 'GET' });
}
