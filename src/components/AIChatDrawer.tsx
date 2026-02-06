import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Send,
  Trash2,
  Copy,
  Check,
  Bot,
  User,
  Sparkles,
  TrendingUp,
  Shield,
  BarChart3,
  MessageSquare,
} from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useChatStore, type ChatMessage as StoredChatMessage } from '@/stores/chatStore';
import { sendChatMessage } from '@/services/chatService';

const WELCOME_FEATURES = [
  { icon: TrendingUp, title: 'Market Analysis', desc: "Ask about any asset's price action and trends", color: 'text-emerald-400' },
  { icon: BarChart3, title: 'Portfolio Review', desc: 'Get insights on your positions and P&L', color: 'text-blue-400' },
  { icon: Shield, title: 'Risk Assessment', desc: 'Evaluate trade ideas before executing', color: 'text-amber-400' },
  { icon: Sparkles, title: 'Strategy Ideas', desc: 'Discuss trading strategies and setups', color: 'text-purple-400' },
];

const SUGGESTED_PROMPTS = [
  "What's happening in the crypto market today?",
  'Analyze my portfolio risk exposure',
  'Should I take profit on my positions?',
  'What are the top trading opportunities right now?',
];

function generateFollowUps(content: string): string[] {
  const lower = content.toLowerCase();
  if (lower.includes('bitcoin') || lower.includes('btc')) {
    return ['What about ETH?', 'Show BTC support levels', 'Compare BTC vs gold'];
  }
  if (lower.includes('portfolio') || lower.includes('position')) {
    return ["What's my biggest risk?", 'Should I rebalance?', 'Show win rate analysis'];
  }
  if (lower.includes('buy') || lower.includes('sell') || lower.includes('trade')) {
    return ["What's the risk/reward?", 'Where should stop-loss be?', 'How much should I size?'];
  }
  if (lower.includes('risk') || lower.includes('drawdown')) {
    return ['How can I reduce risk?', 'Position sizing advice', "What's my VaR?"];
  }
  return ['Analyze top movers', 'Review my portfolio', 'What should I trade?'];
}

export default function AIChatDrawer() {
  const {
    isOpen,
    toggleChat,
    messages,
    isLoading,
    addMessage,
    setLoading,
    clearHistory,
  } = useChatStore();
  const { settings } = useSettingsStore();

  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.role === 'user' || m.role === 'assistant'),
    [messages]
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [visibleMessages, isLoading, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || useChatStore.getState().isLoading) return;

    const historyBefore = [...useChatStore.getState().messages];
    addMessage('user', trimmed);
    setInput('');
    setLoading(true);

    try {
      const reply = await sendChatMessage(trimmed, historyBefore as StoredChatMessage[]);
      addMessage('assistant', reply);
    } catch (err) {
      addMessage(
        'assistant',
        `⚠️ Error: ${err instanceof Error ? err.message : 'Failed to get response'}. Please try again.`
      );
    } finally {
      setLoading(false);
    }
  }, [addMessage, setLoading]);

  const copyMessage = useCallback(async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard errors in unsupported environments.
    }
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 lg:bg-black/30" onClick={toggleChat} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-gray-900 border-l border-gray-700 z-50 flex flex-col animate-[slideInRight_0.3s_ease]">
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900/95">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Bot size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">NexusTrade AI</h2>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${settings.apiKeys.gemini?.key ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="text-[10px] text-gray-400">
                  {settings.apiKeys.gemini?.key ? 'Gemini Connected' : 'Local Mode'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {visibleMessages.length > 0 && (
              <button
                onClick={clearHistory}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                title="Clear chat"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button onClick={toggleChat} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {visibleMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-600/20 border border-purple-500/30 flex items-center justify-center mb-4">
                <Sparkles size={28} className="text-purple-400" />
              </div>
              <h3 className="text-white font-bold text-lg mb-1">Trading Copilot</h3>
              <p className="text-gray-400 text-sm text-center mb-6 max-w-xs">
                Ask anything about markets, your portfolio, or trading strategies
              </p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs mb-6">
                {WELCOME_FEATURES.map((feature) => (
                  <div key={feature.title} className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 text-center">
                    <feature.icon size={18} className={`${feature.color} mx-auto mb-1.5`} />
                    <div className="text-white text-xs font-medium">{feature.title}</div>
                    <div className="text-gray-500 text-[10px] mt-0.5">{feature.desc}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2 w-full max-w-xs">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Try asking:</p>
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="w-full text-left px-3 py-2 bg-gray-800/40 hover:bg-gray-700/60 border border-gray-700/30 hover:border-indigo-500/30 rounded-lg text-sm text-gray-300 hover:text-white transition-all"
                  >
                    <MessageSquare size={12} className="inline mr-2 text-indigo-400" />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {visibleMessages.map((msg, index) => {
                const isLatestAssistant = msg.role === 'assistant' &&
                  visibleMessages.slice(index + 1).every((m) => m.role !== 'assistant');
                const followUps = isLatestAssistant ? generateFollowUps(msg.content) : [];

                return (
                  <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot size={14} className="text-white" />
                      </div>
                    )}
                    <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                      <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-md'
                          : 'bg-gray-800 text-gray-200 rounded-bl-md border border-gray-700/50'
                      }`}>
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1 px-1">
                        <span className="text-[10px] text-gray-600">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.role === 'assistant' && msg.content && (
                          <button
                            onClick={() => copyMessage(msg.id, msg.content)}
                            className="text-gray-600 hover:text-gray-300 transition-colors"
                            title="Copy message"
                          >
                            {copiedId === msg.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          </button>
                        )}
                      </div>
                      {followUps.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {followUps.map((suggestion) => (
                            <button
                              key={suggestion}
                              onClick={() => sendMessage(suggestion)}
                              className="text-xs px-2.5 py-1 bg-gray-800/60 hover:bg-indigo-600/20 border border-gray-700/40 hover:border-indigo-500/40 rounded-full text-gray-400 hover:text-indigo-300 transition-all"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User size={14} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Bot size={14} className="text-white" />
                  </div>
                  <div className="bg-gray-800 border border-gray-700/50 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 border-t border-gray-700 bg-gray-900/95">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              placeholder="Ask about markets, portfolio, or strategies..."
              className="flex-1 bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors"
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white transition-all"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-gray-600 text-center mt-2">
            AI can make mistakes. Not financial advice. Always do your own research.
          </p>
        </div>
      </div>
    </>
  );
}
