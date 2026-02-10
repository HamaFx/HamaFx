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
  Shield,
  BarChart3,
  MessageSquare,
  Target,
  Newspaper,
  Radar,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useChatStore, type ChatMessage as StoredChatMessage } from '@/stores/chatStore';
import { sendChatMessage } from '@/services/chatService';
import { isBackendEnabled } from '@/services/backend/config';
import { getAiRuntimeStatus, getCommandCenter, getNewsIntel } from '@/services/gemini';
import type { AiChatMode, AiCommandCenter, AiNewsIntel, AiRuntimeStatus } from '@/types';

const MODE_CONFIG: Array<{
  id: AiChatMode;
  label: string;
  description: string;
  icon: typeof Bot;
  toneClass: string;
  quickPrompts: string[];
}> = [
  {
    id: 'general',
    label: 'General',
    description: 'Balanced market + portfolio copilot',
    icon: Bot,
    toneClass: 'border-violet-500/30 bg-violet-500/15 text-violet-300',
    quickPrompts: [
      "What is today's market pulse?",
      'Give me top opportunities with risks',
      'Summarize my current trading posture',
    ],
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    description: 'Position and exposure review',
    icon: BarChart3,
    toneClass: 'border-blue-500/30 bg-blue-500/15 text-blue-300',
    quickPrompts: [
      'Analyze my portfolio concentration risk',
      'Which positions should I reduce first?',
      'How should I rebalance today?',
    ],
  },
  {
    id: 'risk',
    label: 'Risk',
    description: 'Downside and guardrail focus',
    icon: Shield,
    toneClass: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
    quickPrompts: [
      'What is my biggest downside risk right now?',
      'How should I size my next trade?',
      'Build a risk checklist before entry',
    ],
  },
  {
    id: 'news',
    label: 'News',
    description: 'Narrative and catalyst lens',
    icon: Newspaper,
    toneClass: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300',
    quickPrompts: [
      'Summarize top catalysts and market regime',
      'How should I trade around this news cycle?',
      'Which assets have strongest headline momentum?',
    ],
  },
  {
    id: 'execution',
    label: 'Execution',
    description: 'Entry, stop, and plan quality',
    icon: Target,
    toneClass: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
    quickPrompts: [
      'Draft a staged execution plan for my setup',
      'Where should invalidation be placed?',
      'Help me define entry, stop, and take-profit',
    ],
  },
];

function sourceLabel(source?: StoredChatMessage['source']): string {
  if (source === 'gemini') return 'Gemini';
  if (source === 'groq') return 'Groq';
  if (source === 'scitely') return 'Scitely';
  if (source === 'backend') return 'Backend';
  return 'Copilot';
}

function modePlaceholder(mode: AiChatMode): string {
  if (mode === 'portfolio') return 'Ask about positions, PnL quality, and rebalance...';
  if (mode === 'risk') return 'Ask for sizing, invalidation, and downside control...';
  if (mode === 'news') return 'Ask about catalysts, regime, and event risk...';
  if (mode === 'execution') return 'Ask for entry plans, stop placement, and execution...';
  return 'Ask about markets, portfolio, or strategy...';
}

function modeContextHint(mode: AiChatMode, commandCenter: AiCommandCenter | null, newsIntel: AiNewsIntel | null): string {
  const hints: string[] = [];
  if (commandCenter?.headline) hints.push(`Command center: ${commandCenter.headline}`);
  if (commandCenter?.posture) hints.push(`Current posture: ${commandCenter.posture}`);
  if (newsIntel?.regime) hints.push(`News regime: ${newsIntel.regime}`);
  if (newsIntel?.catalysts?.length) hints.push(`Top catalyst: ${newsIntel.catalysts[0]}`);

  if (mode === 'portfolio') hints.push('Optimize existing portfolio quality before adding new risk.');
  if (mode === 'risk') hints.push('Prioritize downside protection over upside projection.');
  if (mode === 'news') hints.push('Translate headlines into actionable but risk-bounded scenarios.');
  if (mode === 'execution') hints.push('Prioritize concrete trade plans with invalidation and staging.');

  return hints.join('\n');
}

function generateFollowUps(content: string, mode: AiChatMode): string[] {
  const lower = content.toLowerCase();
  if (mode === 'risk') return ['How can I reduce drawdown risk?', 'What position size is safer?', 'What is my invalidation checklist?'];
  if (mode === 'news') return ['What is the current regime?', 'Which catalyst matters most now?', 'How should I adjust risk around news?'];
  if (mode === 'execution') return ['Build entry + stop + TP plan', 'How should I scale into this?', 'What would cancel this setup?'];
  if (mode === 'portfolio') return ['What is my concentration risk?', 'Which position is weakest?', 'How should I rebalance?'];

  if (lower.includes('bitcoin') || lower.includes('btc')) {
    return ['What about ETH?', 'Show BTC risk levels', 'Compare BTC vs DXY context'];
  }
  if (lower.includes('portfolio') || lower.includes('position')) {
    return ['Show concentration risk', 'Should I rebalance now?', 'What is my win/loss quality?'];
  }
  if (lower.includes('risk') || lower.includes('drawdown')) {
    return ['How can I reduce risk?', 'Position sizing advice', 'What should I avoid right now?'];
  }
  return ['Analyze top movers', 'Review my portfolio', 'Build a trade plan'];
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
  const backendAiReady = isBackendEnabled();

  const [mode, setMode] = useState<AiChatMode>('general');
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<AiRuntimeStatus | null>(null);
  const [commandCenter, setCommandCenter] = useState<AiCommandCenter | null>(null);
  const [newsIntel, setNewsIntel] = useState<AiNewsIntel | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const modeMeta = useMemo(
    () => MODE_CONFIG.find((item) => item.id === mode) ?? MODE_CONFIG[0],
    [mode]
  );

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.role === 'user' || m.role === 'assistant'),
    [messages]
  );

  const quickPrompts = useMemo(() => {
    const dynamic = [
      ...(commandCenter?.topActions ?? []).slice(0, 2),
      ...(newsIntel?.catalysts ?? []).slice(0, 1).map((item) => `Explain catalyst: ${item}`),
    ];
    const merged = [...modeMeta.quickPrompts, ...dynamic].filter((item) => item && item.length > 0);
    return [...new Set(merged)].slice(0, 6);
  }, [commandCenter?.topActions, modeMeta.quickPrompts, newsIntel?.catalysts]);

  const runtimeSummary = useMemo(() => {
    if (!runtimeStatus) return backendAiReady ? 'Backend connected' : 'Local mode';
    if (!runtimeStatus.hasAnyProvider) return 'Fallback intelligence active';
    const chain = runtimeStatus.providerOrder.join(' -> ');
    return runtimeStatus.preferredProvider === 'auto'
      ? `Auto router: ${chain}`
      : `Pinned: ${runtimeStatus.preferredProvider} (${chain})`;
  }, [backendAiReady, runtimeStatus]);

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

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') toggleChat();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, toggleChat]);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setIntelLoading(true);
    setIntelError(null);

    void Promise.allSettled([
      getAiRuntimeStatus(),
      getCommandCenter(),
      getNewsIntel('all'),
    ]).then((results) => {
      if (!active) return;
      const [runtimeResult, commandResult, newsResult] = results;

      if (runtimeResult.status === 'fulfilled') setRuntimeStatus(runtimeResult.value);
      if (commandResult.status === 'fulfilled') setCommandCenter(commandResult.value);
      if (newsResult.status === 'fulfilled') setNewsIntel(newsResult.value);

      const rejected = results.filter((result) => result.status === 'rejected').length;
      if (rejected > 0 && backendAiReady) {
        setIntelError('Some AI intelligence panels are temporarily unavailable.');
      }
    }).finally(() => {
      if (active) setIntelLoading(false);
    });

    return () => {
      active = false;
    };
  }, [isOpen, backendAiReady]);

  const sendMessage = useCallback(async (text: string, explicitContextHint?: string) => {
    const trimmed = text.trim();
    if (!trimmed || useChatStore.getState().isLoading) return;

    const historyBefore = [...useChatStore.getState().messages];
    const contextHint = explicitContextHint || modeContextHint(mode, commandCenter, newsIntel);

    addMessage('user', trimmed, undefined, {
      source: backendAiReady ? 'backend' : 'rule-based',
    });
    setInput('');
    setLoading(true);

    try {
      const reply = await sendChatMessage(trimmed, historyBefore as StoredChatMessage[], {
        mode,
        contextHint,
      });
      addMessage('assistant', reply.reply, undefined, {
        followUps: reply.followUps,
        riskLevel: reply.riskLevel,
        source: reply.source,
      });
    } catch (err) {
      addMessage(
        'assistant',
        `Error: ${err instanceof Error ? err.message : 'Failed to get response'}. Please try again.`,
        undefined,
        { source: 'rule-based', riskLevel: 'medium' }
      );
    } finally {
      setLoading(false);
    }
  }, [addMessage, backendAiReady, commandCenter, mode, newsIntel, setLoading]);

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
      <button
        type="button"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 lg:bg-black/30"
        aria-label="Close AI chat"
        onClick={toggleChat}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="HamaFX AI chat"
        className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-gray-900 border-l border-gray-700 z-[60] flex flex-col animate-[slideInRight_0.3s_ease] modal-scroll-contain"
      >
        <div className="border-b border-gray-700 bg-gray-900/95">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                <Bot size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-white text-sm">HamaFX AI Copilot</h2>
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className={`w-1.5 h-1.5 rounded-full ${backendAiReady || settings.apiKeys.gemini?.key ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <span className="text-xs text-gray-400 truncate">
                    {runtimeSummary}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {visibleMessages.length > 0 && (
                <button
                  onClick={clearHistory}
                  aria-label="Clear chat history"
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                  title="Clear chat"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button type="button" onClick={toggleChat} aria-label="Close AI chat" className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {MODE_CONFIG.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-full border transition-colors whitespace-nowrap ${
                    mode === item.id ? item.toneClass : 'border-gray-700 bg-gray-800/60 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <item.icon size={12} />
                  {item.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5">{modeMeta.description}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {visibleMessages.length === 0 ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-gray-700 bg-gradient-to-br from-violet-500/10 via-gray-900 to-indigo-500/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} className="text-violet-300" />
                  <p className="text-sm font-semibold text-white">Copilot Mission Board</p>
                  {intelLoading && <Loader2 size={14} className="text-gray-400 animate-spin" />}
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {commandCenter?.headline || 'Ask for live market intelligence, risk review, or execution planning.'}
                </p>
                {commandCenter?.posture && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${
                      commandCenter.posture === 'offensive'
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : commandCenter.posture === 'defensive'
                        ? 'bg-red-500/10 text-red-300'
                        : 'bg-amber-500/10 text-amber-300'
                    }`}>
                      {commandCenter.posture} posture
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-medium">
                      Confidence {Number.isFinite(commandCenter.confidence) ? `${commandCenter.confidence.toFixed(0)}%` : 'N/A'}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => sendMessage('Build my immediate action plan from command center.')}
                  className="text-left rounded-xl border border-gray-700 bg-gray-800/60 p-3 hover:border-violet-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2 text-violet-300 text-xs font-semibold">
                    <Radar size={13} /> Command Plan
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Generate prioritized actions and blockers.</p>
                </button>
                <button
                  type="button"
                  onClick={() => sendMessage('Summarize the current news regime and top catalyst risks.')}
                  className="text-left rounded-xl border border-gray-700 bg-gray-800/60 p-3 hover:border-cyan-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2 text-cyan-300 text-xs font-semibold">
                    <Newspaper size={13} /> News Regime
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {newsIntel?.regime ? `Current regime: ${newsIntel.regime}` : 'Get narrative and catalyst intelligence.'}
                  </p>
                </button>
              </div>

              {runtimeStatus && (
                <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-3">
                  <p className="text-xs font-semibold text-gray-300 mb-1">Runtime Status</p>
                  <p className="text-xs text-gray-400">
                    {runtimeStatus.hasAnyProvider
                      ? `Providers: ${runtimeStatus.configuredProviders.join(', ')}`
                      : 'No providers configured. Running deterministic fallback intelligence.'}
                  </p>
                  {runtimeStatus.notes.length > 0 && (
                    <p className="text-[11px] text-gray-500 mt-1">{runtimeStatus.notes[0]}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Quick start prompts</p>
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="w-full text-left px-3 py-2 bg-gray-800/40 hover:bg-gray-700/60 border border-gray-700/30 hover:border-indigo-500/30 rounded-lg text-sm text-gray-300 hover:text-white transition-[background-color,border-color,color] duration-200"
                  >
                    <MessageSquare size={12} className="inline mr-2 text-indigo-400" />
                    {prompt}
                  </button>
                ))}
              </div>

              {intelError && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 flex items-center gap-2">
                  <AlertTriangle size={13} />
                  {intelError}
                </div>
              )}
            </div>
          ) : (
            <>
              {quickPrompts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-xs px-2.5 py-1 bg-gray-800/60 hover:bg-indigo-600/20 border border-gray-700/40 hover:border-indigo-500/40 rounded-full text-gray-400 hover:text-indigo-300 transition-[background-color,border-color,color] duration-200"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {visibleMessages.map((msg, index) => {
                const isLatestAssistant = msg.role === 'assistant' &&
                  visibleMessages.slice(index + 1).every((m) => m.role !== 'assistant');
                const followUps = isLatestAssistant
                  ? (Array.isArray(msg.followUps) && msg.followUps.length > 0
                    ? msg.followUps
                    : generateFollowUps(msg.content, mode))
                  : [];

                return (
                  <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot size={14} className="text-white" />
                      </div>
                    )}
                    <div className={`max-w-[86%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                      <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-md'
                          : 'bg-gray-800 text-gray-200 rounded-bl-md border border-gray-700/50'
                      }`}>
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1 px-1 flex-wrap">
                        <span className="text-xs text-gray-600">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.role === 'assistant' && msg.riskLevel && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              msg.riskLevel === 'high'
                                ? 'bg-red-500/10 text-red-400'
                                : msg.riskLevel === 'medium'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-emerald-500/10 text-emerald-400'
                            }`}
                          >
                            risk: {msg.riskLevel}
                          </span>
                        )}
                        {msg.role === 'assistant' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700/60 text-gray-300">
                            {sourceLabel(msg.source)}
                          </span>
                        )}
                        {msg.role === 'assistant' && msg.content && (
                          <button
                            onClick={() => copyMessage(msg.id, msg.content)}
                            aria-label="Copy assistant message"
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
                              className="text-xs px-2.5 py-1 bg-gray-800/60 hover:bg-indigo-600/20 border border-gray-700/40 hover:border-indigo-500/40 rounded-full text-gray-400 hover:text-indigo-300 transition-[background-color,border-color,color] duration-200"
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
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Bot size={14} className="text-white" />
                  </div>
                  <div className="bg-gray-800 border border-gray-700/50 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 border-t border-gray-700 bg-gray-900/95">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${modeMeta.toneClass}`}>
              Mode: {modeMeta.label}
            </span>
            {runtimeStatus?.providerOrder?.length ? (
              <span className="text-[10px] text-gray-500 truncate max-w-[65%] text-right">
                {runtimeStatus.providerOrder.join(' -> ')}
              </span>
            ) : (
              <span className="text-[10px] text-gray-600">Fallback aware</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              aria-label="Chat message input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void sendMessage(input);
                }
              }}
              placeholder={modePlaceholder(mode)}
              className="flex-1 bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors"
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              aria-label="Send chat message"
              className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white transition-[background-position,opacity,transform] duration-200"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-xs text-gray-600 text-center mt-2">
            AI can make mistakes. Not financial advice. Always do your own research.
          </p>
        </div>
      </div>
    </>
  );
}
