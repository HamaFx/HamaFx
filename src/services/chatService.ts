import { usePortfolioStore } from '@/stores/portfolioStore';
import { useMarketStore } from '@/stores/marketStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useAlertStore } from '@/stores/alertStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ChatMessage } from '@/stores/chatStore';

function buildPortfolioContext(): string {
  const { positions, virtualBalance, tradeHistory, getTotalValue } = usePortfolioStore.getState();
  if (positions.length === 0 && tradeHistory.length === 0) {
    return `Portfolio: $${virtualBalance.toLocaleString()} cash, no open positions, no trade history.`;
  }

  const positionSummary = positions.map(p => {
    const pnl = p.side === 'long'
      ? (p.currentPrice - p.entryPrice) * p.quantity
      : (p.entryPrice - p.currentPrice) * p.quantity;
    const pnlPct = p.entryPrice > 0 ? (pnl / (p.entryPrice * p.quantity)) * 100 : 0;
    return `- ${p.symbol} (${p.side}): qty ${p.quantity}, entry $${p.entryPrice.toFixed(2)}, current $${p.currentPrice.toFixed(2)}, P&L ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`;
  }).join('\n');

  const totalValue = getTotalValue();
  const winRate = tradeHistory.length > 0
    ? `${((tradeHistory.filter(t => (t.pnl || 0) > 0).length / tradeHistory.length) * 100).toFixed(0)}%`
    : 'N/A';

  return `Portfolio Summary:
- Total Value: $${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
- Cash: $${virtualBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
- Open Positions (${positions.length}):
${positionSummary || '  None'}
- Total Trades: ${tradeHistory.length}, Win Rate: ${winRate}`;
}

function buildMarketContext(): string {
  const { cryptoAssets, forexPairs } = useMarketStore.getState();
  const top5 = cryptoAssets.slice(0, 5);
  
  const cryptoLines = top5.map(a => 
    `- ${a.symbol.toUpperCase()}: $${a.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${a.changePercent24h >= 0 ? '+' : ''}${a.changePercent24h.toFixed(1)}%)`
  ).join('\n');

  const forexLines = forexPairs.slice(0, 4).map(f =>
    `- ${f.symbol}: ${f.rate.toFixed(4)} (${f.changePercent24h >= 0 ? '+' : ''}${f.changePercent24h.toFixed(2)}%)`
  ).join('\n');

  return `Market Overview:
Crypto:
${cryptoLines}
Forex:
${forexLines}`;
}

function buildWatchlistContext(): string {
  const { watchlists } = useWatchlistStore.getState();
  const allSymbols = watchlists.flatMap(w => w.symbols.map(s => s.symbol));
  if (allSymbols.length === 0) return 'Watchlist: Empty';
  return `Watchlist assets: ${[...new Set(allSymbols)].join(', ')}`;
}

function buildAlertContext(): string {
  const { alerts } = useAlertStore.getState();
  const active = alerts.filter(a => a.isActive && !a.isTriggered);
  const triggered = alerts.filter(a => a.isTriggered);
  if (alerts.length === 0) return 'Alerts: None configured';
  return `Alerts: ${active.length} active, ${triggered.length} triggered. Active: ${active.map(a => `${a.symbol} ${a.type} ${a.targetValue}`).join('; ')}`;
}

function buildFullContext(): string {
  return [
    buildPortfolioContext(),
    buildMarketContext(),
    buildWatchlistContext(),
    buildAlertContext(),
  ].join('\n\n');
}

const SYSTEM_PROMPT = `You are NexusTrade AI, an expert trading assistant for a paper trading platform. You have access to the user's portfolio, positions, watchlist, alerts, and live market data.

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
): Promise<string> {
  const apiKey = useSettingsStore.getState().getGeminiKey();

  if (!apiKey) {
    return generateLocalResponse(userMessage);
  }

  const context = buildFullContext();
  
  // Build conversation history (last 10 messages for context window)
  const recentHistory = chatHistory.slice(-10).map(m => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }],
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
    const res = await fetch(
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

    if (!res.ok) {
      if (res.status === 429) return '⚠️ Rate limit reached. Please wait a moment and try again.';
      if (res.status === 401 || res.status === 403) return '⚠️ Invalid API key. Please check your Gemini API key in Settings.';
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response');
    return text;
  } catch (e) {
    console.error('Chat API error:', e);
    return generateLocalResponse(userMessage);
  }
}

function generateLocalResponse(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('portfolio') || lower.includes('position') || lower.includes('balance')) {
    return `📊 Here's your current status:\n\n${buildPortfolioContext()}\n\n💡 *Tip: Add a Gemini API key in Settings for detailed AI analysis.*`;
  }

  if (lower.includes('market') || lower.includes('price') || lower.includes('bitcoin') || lower.includes('btc') || lower.includes('eth')) {
    return `📈 Current market snapshot:\n\n${buildMarketContext()}\n\n💡 *Add a Gemini API key for in-depth market analysis.*`;
  }

  if (lower.includes('watchlist')) {
    return `👀 ${buildWatchlistContext()}\n\n💡 *Add a Gemini API key for watchlist analysis.*`;
  }

  if (lower.includes('alert')) {
    return `🔔 ${buildAlertContext()}\n\n💡 *Add a Gemini API key for smart alert suggestions.*`;
  }

  if (lower.includes('help') || lower.includes('what can you do')) {
    return `🤖 **NexusTrade AI Assistant**\n\nI can help with:\n• 📊 Portfolio analysis & risk assessment\n• 📈 Market analysis & price insights\n• 💡 Trade ideas & strategy discussion\n• 🔔 Alert & watchlist suggestions\n• 📚 Trading concepts & education\n\n⚡ *For full AI capabilities, add your free Gemini API key in Settings → API Keys.*`;
  }

  return `I can help with portfolio analysis, market insights, and trading questions.\n\n${buildPortfolioContext()}\n\n${buildMarketContext()}\n\n💡 *For detailed AI responses, add a free Gemini API key in Settings → API Keys.*`;
}
