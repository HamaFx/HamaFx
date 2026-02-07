import { usePortfolioStore } from '@/stores/portfolioStore';
import { useMarketStore } from '@/stores/marketStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useAlertStore } from '@/stores/alertStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ChatAssistantResponse } from '@/types';
import type { ChatMessage } from '@/stores/chatStore';
import { isBackendEnabled } from '@/services/backend/config';
import { apiAiChat } from '@/services/backend/aiApi';

function buildPortfolioContext(): string {
  const { positions, virtualBalance, tradeHistory, getTotalValue } = usePortfolioStore.getState();
  if (positions.length === 0 && tradeHistory.length === 0) {
    return `Portfolio: $${virtualBalance.toLocaleString()} cash, no open positions, no trade history.`;
  }

  const positionSummary = positions.map((p) => {
    const pnl = p.side === 'long'
      ? (p.currentPrice - p.entryPrice) * p.quantity
      : (p.entryPrice - p.currentPrice) * p.quantity;
    const pnlPct = p.entryPrice > 0 ? (pnl / (p.entryPrice * p.quantity)) * 100 : 0;
    return `- ${p.symbol} (${p.side}): qty ${p.quantity}, entry $${p.entryPrice.toFixed(2)}, current $${p.currentPrice.toFixed(2)}, P&L ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`;
  }).join('\n');

  const totalValue = getTotalValue();
  const winRate = tradeHistory.length > 0
    ? `${((tradeHistory.filter((t) => (t.pnl || 0) > 0).length / tradeHistory.length) * 100).toFixed(0)}%`
    : 'N/A';

  return `Portfolio Summary:\n- Total Value: $${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n- Cash: $${virtualBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n- Open Positions (${positions.length}):\n${positionSummary || '  None'}\n- Total Trades: ${tradeHistory.length}, Win Rate: ${winRate}`;
}

function buildMarketContext(): string {
  const { cryptoAssets, forexPairs } = useMarketStore.getState();
  const top5 = cryptoAssets.slice(0, 5);

  const cryptoLines = top5.map((a) =>
    `- ${a.symbol.toUpperCase()}: $${a.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${a.changePercent24h >= 0 ? '+' : ''}${a.changePercent24h.toFixed(1)}%)`
  ).join('\n');

  const forexLines = forexPairs.slice(0, 4).map((f) =>
    `- ${f.symbol}: ${f.rate.toFixed(4)} (${f.changePercent24h >= 0 ? '+' : ''}${f.changePercent24h.toFixed(2)}%)`
  ).join('\n');

  return `Market Overview:\nCrypto:\n${cryptoLines}\nForex:\n${forexLines}`;
}

function buildWatchlistContext(): string {
  const { watchlists } = useWatchlistStore.getState();
  const allSymbols = watchlists.flatMap((w) => w.symbols.map((s) => s.symbol));
  if (allSymbols.length === 0) return 'Watchlist: Empty';
  return `Watchlist assets: ${[...new Set(allSymbols)].join(', ')}`;
}

function buildAlertContext(): string {
  const { alerts } = useAlertStore.getState();
  const active = alerts.filter((a) => a.isActive && !a.isTriggered);
  const triggered = alerts.filter((a) => a.isTriggered);
  if (alerts.length === 0) return 'Alerts: None configured';
  return `Alerts: ${active.length} active, ${triggered.length} triggered. Active: ${active.map((a) => `${a.symbol} ${a.type} ${a.targetValue}`).join('; ')}`;
}

function buildFullContext(): string {
  return [
    buildPortfolioContext(),
    buildMarketContext(),
    buildWatchlistContext(),
    buildAlertContext(),
  ].join('\n\n');
}

const SYSTEM_PROMPT = `You are HamaFX AI, an expert trading assistant for a paper trading platform. You have access to the user's portfolio, positions, watchlist, alerts, and live market data.

RULES:
1. Be concise but insightful. Use bullet points when listing.
2. Always include risk warnings when discussing specific trades.
3. Never guarantee profits or recommend real money trading.
4. Reference the user's actual positions and data when relevant.
5. Use financial terminology accurately.
6. If asked about specific trades, analyze entry/exit, risk/reward, and position sizing.
7. Format numbers with $ signs and appropriate decimal places.
8. This is a PAPER TRADING platform — always remind users when relevant.

DISCLAIMER: All analysis is for educational purposes only. Past performance does not guarantee future results.`;

export async function sendChatMessage(
  userMessage: string,
  chatHistory: ChatMessage[]
): Promise<ChatAssistantResponse> {
  if (isBackendEnabled()) {
    try {
      const historyPayload = chatHistory
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .slice(-10)
        .map((message) => ({ role: message.role as 'user' | 'assistant', content: message.content }));

      const backend = await apiAiChat({
        message: userMessage,
        history: historyPayload,
      });

      return {
        ...backend,
        source: backend.source === 'gemini' || backend.source === 'rule-based' ? backend.source : 'backend',
      };
    } catch (error) {
      console.warn('[Chat] Backend chat failed, trying direct Gemini/local fallback:', error);
    }
  }

  const apiKey = useSettingsStore.getState().getGeminiKey();
  if (!apiKey) {
    return generateLocalResponse(userMessage);
  }

  const context = buildFullContext();

  const recentHistory = chatHistory.slice(-10).map((message) => ({
    role: message.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: message.content }],
  }));

  const contents = [
    {
      role: 'user' as const,
      parts: [{ text: `${SYSTEM_PROMPT}\n\nCURRENT CONTEXT:\n${context}` }],
    },
    {
      role: 'model' as const,
      parts: [{ text: 'Understood. I have access to your portfolio, market data, watchlist, and alerts. How can I help?' }],
    },
    ...recentHistory,
    {
      role: 'user' as const,
      parts: [{ text: userMessage }],
    },
  ];

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
            topP: 0.9,
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return {
          reply: '⚠️ Rate limit reached. Please wait a moment and try again.',
          followUps: ['Try again in a moment', 'Review my portfolio risk'],
          riskLevel: 'medium',
          generatedAt: new Date().toISOString(),
          source: 'rule-based',
        };
      }
      if (response.status === 401 || response.status === 403) {
        return {
          reply: '⚠️ Invalid API key. Please check your Gemini API key in Settings.',
          followUps: ['Open Settings', 'Use local AI mode for now'],
          riskLevel: 'medium',
          generatedAt: new Date().toISOString(),
          source: 'rule-based',
        };
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const text = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response');

    return {
      reply: text,
      followUps: [],
      riskLevel: 'medium',
      generatedAt: new Date().toISOString(),
      source: 'gemini',
    };
  } catch (error) {
    console.error('Chat API error:', error);
    return generateLocalResponse(userMessage);
  }
}

function generateLocalResponse(message: string): ChatAssistantResponse {
  const lower = message.toLowerCase();

  if (lower.includes('portfolio') || lower.includes('position') || lower.includes('balance')) {
    return {
      reply: `📊 Here's your current status:\n\n${buildPortfolioContext()}\n\n💡 Tip: Enable backend AI mode for deeper strategy guidance and proactive recommendations.`,
      followUps: ['What is my biggest portfolio risk?', 'How should I rebalance?', 'Show my recent performance'],
      riskLevel: 'medium',
      generatedAt: new Date().toISOString(),
      source: 'rule-based',
    };
  }

  if (lower.includes('market') || lower.includes('price') || lower.includes('bitcoin') || lower.includes('btc') || lower.includes('eth')) {
    return {
      reply: `📈 Current market snapshot:\n\n${buildMarketContext()}\n\n💡 Enable backend AI for narrative-aware market intelligence and opportunity ranking.`,
      followUps: ['Give me top opportunities', 'Summarize risk-on vs risk-off', 'Which assets are overextended?'],
      riskLevel: 'medium',
      generatedAt: new Date().toISOString(),
      source: 'rule-based',
    };
  }

  if (lower.includes('watchlist')) {
    return {
      reply: `👀 ${buildWatchlistContext()}\n\n💡 Backend AI can score your watchlist by momentum and risk profile.`,
      followUps: ['Rank my watchlist', 'Find the highest-risk symbol', 'Suggest alert levels'],
      riskLevel: 'low',
      generatedAt: new Date().toISOString(),
      source: 'rule-based',
    };
  }

  if (lower.includes('alert')) {
    return {
      reply: `🔔 ${buildAlertContext()}\n\n💡 Backend AI can suggest smarter alert thresholds based on volatility.`,
      followUps: ['Suggest new alert levels', 'Show triggered alerts context', 'What alerts am I missing?'],
      riskLevel: 'low',
      generatedAt: new Date().toISOString(),
      source: 'rule-based',
    };
  }

  return {
    reply: `I can help with portfolio analysis, market context, and trade planning.\n\n${buildPortfolioContext()}\n\n${buildMarketContext()}\n\nEnable backend AI mode for full copilot intelligence.`,
    followUps: ['Analyze my risk exposure', 'Find top opportunities now', 'Build me a trade plan template'],
    riskLevel: 'medium',
    generatedAt: new Date().toISOString(),
    source: 'rule-based',
  };
}
