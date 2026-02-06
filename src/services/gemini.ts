// Google Gemini AI Service — Market analysis, sentiment, trade evaluation
// Uses user-provided API key from Settings
// Falls back to rule-based engine when key is not available

import type { AiAnalysisResult, SentimentResult, MarketSummary } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';
import { cacheService } from '@/services/cache';
import { rateLimiter } from '@/services/rateLimiter';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function getApiKey(): string | null {
  return useSettingsStore.getState().getGeminiKey();
}

async function callGemini(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No Gemini API key configured');

  if (!rateLimiter.canMakeRequest('gemini')) {
    throw new Error('Rate limited — please wait before requesting another analysis');
  }

  rateLimiter.recordRequest('gemini');

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [{
        parts: [{ text: prompt }],
      }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 429) throw new Error('RATE_LIMITED');
    if (response.status === 403) throw new Error('INVALID_KEY');
    throw new Error(errorData?.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');

  return text;
}

function parseJSON<T>(text: string): T {
  // Extract JSON from markdown code blocks if present
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr);
}

// ===== Market Analysis =====
export async function getMarketAnalysis(
  assetName: string,
  assetSymbol: string,
  context: Record<string, unknown>
): Promise<AiAnalysisResult> {
  const cacheKey = `ai_analysis_${assetSymbol}`;
  const cached = cacheService.get<AiAnalysisResult>(cacheKey);
  if (cached) return cached;

  const systemPrompt = `You are a professional financial market analyst. Analyze the provided market data and generate a structured trading analysis. You MUST respond with valid JSON only, no markdown, no explanation outside the JSON.

IMPORTANT: Always include risk warnings. Never guarantee returns. This is for educational purposes only.

Respond with this exact JSON structure:
{
  "signal": "BUY" | "SELL" | "HOLD",
  "confidence": <number 0-100>,
  "reasoning": [<string>, <string>, ...],
  "riskFactors": [<string>, <string>, ...],
  "supportLevel": <number>,
  "resistanceLevel": <number>,
  "suggestedStopLoss": <number>,
  "suggestedTakeProfit": <number>,
  "timeHorizon": "short-term" | "medium-term" | "long-term",
  "summary": "<1-2 sentence summary>"
}`;

  const prompt = `Analyze ${assetName} (${assetSymbol}) with the following market data:

${JSON.stringify(context, null, 2)}

Provide a comprehensive trading analysis.`;

  try {
    const text = await callGemini(prompt, systemPrompt);
    const parsed = parseJSON<Omit<AiAnalysisResult, 'source' | 'generatedAt'>>(text);

    const result: AiAnalysisResult = {
      signal: parsed.signal || 'HOLD',
      confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.slice(0, 5) : ['Analysis generated'],
      riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors.slice(0, 4) : ['AI-generated analysis — not financial advice'],
      supportLevel: parsed.supportLevel,
      resistanceLevel: parsed.resistanceLevel,
      suggestedStopLoss: parsed.suggestedStopLoss,
      suggestedTakeProfit: parsed.suggestedTakeProfit,
      timeHorizon: parsed.timeHorizon || 'short-term',
      summary: parsed.summary || 'Analysis complete.',
      source: 'gemini',
      generatedAt: new Date().toISOString(),
    };

    cacheService.set(cacheKey, result, 300_000); // 5 min cache
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg === 'RATE_LIMITED' || msg === 'INVALID_KEY') throw error;
    // Try once more with simpler prompt
    throw new Error(`AI analysis failed: ${msg}`);
  }
}

// ===== Sentiment Analysis =====
export async function getSentimentAnalysis(
  assetSymbol: string,
  headlines: string[]
): Promise<SentimentResult> {
  const cacheKey = `ai_sentiment_${assetSymbol}`;
  const cached = cacheService.get<SentimentResult>(cacheKey);
  if (cached) return cached;

  if (headlines.length === 0) {
    return {
      overallSentiment: 0,
      sentimentLabel: 'neutral',
      keyThemes: [],
      impactAssessment: 'low',
      reasoning: 'No news headlines available for analysis.',
      source: 'none',
    };
  }

  const systemPrompt = `You are a financial sentiment analyst. Analyze the following news headlines and provide a sentiment assessment. Respond with valid JSON only.

Respond with:
{
  "overallSentiment": <number -100 to +100>,
  "sentimentLabel": "very_bearish" | "bearish" | "neutral" | "bullish" | "very_bullish",
  "keyThemes": [<string>, ...],
  "impactAssessment": "low" | "medium" | "high",
  "reasoning": "<2-3 sentence explanation>"
}`;

  const prompt = `Analyze sentiment for ${assetSymbol} based on these headlines:

${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}`;

  try {
    const text = await callGemini(prompt, systemPrompt);
    const parsed = parseJSON<Omit<SentimentResult, 'source'>>(text);

    const result: SentimentResult = {
      overallSentiment: Math.min(100, Math.max(-100, parsed.overallSentiment || 0)),
      sentimentLabel: parsed.sentimentLabel || 'neutral',
      keyThemes: Array.isArray(parsed.keyThemes) ? parsed.keyThemes.slice(0, 4) : [],
      impactAssessment: parsed.impactAssessment || 'low',
      reasoning: parsed.reasoning || 'Sentiment analysis complete.',
      source: 'gemini',
    };

    cacheService.set(cacheKey, result, 600_000); // 10 min cache
    return result;
  } catch (error) {
    throw error;
  }
}

// ===== Market Summary (Dashboard) =====
export async function getMarketSummary(
  marketData: Record<string, unknown>
): Promise<MarketSummary> {
  const cacheKey = 'ai_market_summary';
  const cached = cacheService.get<MarketSummary>(cacheKey);
  if (cached) return cached;

  const systemPrompt = `You are a financial market commentator. Given today's market data, write a brief market summary. Respond with valid JSON only.

Respond with:
{
  "summary": "<3-4 sentence market summary>",
  "marketMood": "risk-on" | "risk-off" | "mixed" | "uncertain",
  "keyEvent": "<most impactful factor today>",
  "outlook": "<1 sentence forward-looking view with caveat>"
}`;

  const prompt = `Summarize today's market conditions:

${JSON.stringify(marketData, null, 2)}`;

  try {
    const text = await callGemini(prompt, systemPrompt);
    const parsed = parseJSON<Omit<MarketSummary, 'source' | 'generatedAt'>>(text);

    const result: MarketSummary = {
      summary: parsed.summary || 'Market summary unavailable.',
      marketMood: parsed.marketMood || 'mixed',
      keyEvent: parsed.keyEvent || 'No major events',
      outlook: parsed.outlook || 'Outlook uncertain.',
      source: 'gemini',
      generatedAt: new Date().toISOString(),
    };

    cacheService.set(cacheKey, result, 900_000); // 15 min cache
    return result;
  } catch (error) {
    throw error;
  }
}

// ===== Helper: Check if Gemini is available =====
export function isGeminiAvailable(): boolean {
  return !!getApiKey();
}

// ===== Trade Evaluation =====
export async function callGeminiForTradeEval(params: {
  side: string; symbol: string; quantity: number; price: number;
  portfolioValue: number; assetType: string;
}): Promise<import('@/types').TradeEvalResult> {
  const cacheKey = `ai_trade_eval_${params.symbol}_${params.side}`;
  const cached = cacheService.get<import('@/types').TradeEvalResult>(cacheKey);
  if (cached) return cached;

  const systemPrompt = `You are a risk management advisor. A trader is considering a paper trade. Evaluate it and provide structured risk feedback. Respond with valid JSON only.

Respond with:
{
  "riskRating": "low" | "medium" | "high" | "very_high",
  "positionSizeAssessment": "appropriate" | "too_large" | "too_small",
  "diversificationImpact": "<1 sentence>",
  "suggestions": ["<suggestion>", "<suggestion>"],
  "warning": "<optional warning or null>"
}`;

  const prompt = `Evaluate this paper trade:
- Action: ${params.side.toUpperCase()} ${params.quantity.toFixed(4)} ${params.symbol}
- Price: $${params.price.toFixed(2)}
- Total: $${(params.quantity * params.price).toFixed(2)}
- Portfolio Value: $${params.portfolioValue.toFixed(2)}
- Asset Type: ${params.assetType}
- Position as % of portfolio: ${((params.quantity * params.price / params.portfolioValue) * 100).toFixed(1)}%`;

  try {
    const text = await callGemini(prompt, systemPrompt);
    const parsed = parseJSON<import('@/types').TradeEvalResult>(text);
    const result: import('@/types').TradeEvalResult = {
      riskRating: parsed.riskRating || 'medium',
      positionSizeAssessment: parsed.positionSizeAssessment || 'appropriate',
      diversificationImpact: parsed.diversificationImpact || 'N/A',
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
      warning: parsed.warning || undefined,
    };
    cacheService.set(cacheKey, result, 120_000); // 2 min cache
    return result;
  } catch {
    return {
      riskRating: 'medium',
      positionSizeAssessment: (params.quantity * params.price / params.portfolioValue) > 0.2 ? 'too_large' : 'appropriate',
      diversificationImpact: 'Unable to assess — AI unavailable',
      suggestions: ['Consider position size relative to portfolio', 'Set stop-loss to manage risk'],
    };
  }
}

// ===== Keyword-based sentiment fallback =====
const POSITIVE_WORDS = ['surge', 'rally', 'gain', 'bull', 'soar', 'jump', 'rise', 'up', 'high', 'record', 'growth', 'profit', 'boost', 'optimis', 'strong', 'recover', 'breakout', 'inflow', 'adopt', 'approve'];
const NEGATIVE_WORDS = ['crash', 'drop', 'fall', 'bear', 'plunge', 'decline', 'loss', 'down', 'low', 'sell', 'fear', 'risk', 'warn', 'hack', 'ban', 'restrict', 'outflow', 'concern', 'weak', 'fail'];

export function keywordSentiment(headline: string): number {
  const lower = headline.toLowerCase();
  let score = 0;
  POSITIVE_WORDS.forEach(w => { if (lower.includes(w)) score += 15; });
  NEGATIVE_WORDS.forEach(w => { if (lower.includes(w)) score -= 15; });
  return Math.max(-100, Math.min(100, score));
}
