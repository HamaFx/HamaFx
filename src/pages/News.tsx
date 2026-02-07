import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Newspaper,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Bot,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  Clock,
  Globe,
  ArrowDownAZ,
  Flame,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { fetchNews } from '@/services/newsService';
import { getNewsBrief, getSentimentAnalysis, isGeminiAvailable } from '@/services/gemini';
import type { AiNewsBrief, NewsArticle, SentimentResult } from '@/types';

type CategoryFilter = 'all' | 'crypto' | 'forex' | 'economy' | 'general';
type SortMode = 'latest' | 'oldest' | 'bullish' | 'bearish';
type TimeWindow = '24h' | '7d' | 'all';
type SourceFilter = 'all' | 'newsdata' | 'curated';

function SentimentBadge({ sentiment, source }: { sentiment: number; source?: string }) {
  const label = sentiment > 30 ? 'Bullish' : sentiment < -30 ? 'Bearish' : 'Neutral';
  const color =
    sentiment > 30
      ? 'text-emerald-400 bg-emerald-500/10'
      : sentiment < -30
      ? 'text-red-400 bg-red-500/10'
      : 'text-amber-400 bg-amber-500/10';
  const icon = sentiment > 30 ? TrendingUp : sentiment < -30 ? TrendingDown : Minus;
  const Icon = icon;

  return (
    <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', color)}>
      <Icon className="w-2.5 h-2.5" />
      {label}
      {source === 'gemini' && <Bot className="w-2.5 h-2.5 text-violet-400 ml-0.5" />}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = Date.parse(dateStr);
  if (Number.isNaN(then)) return 'just now';

  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function Shimmer({ className }: { className?: string }) {
  return <div className={cn('animate-shimmer rounded-lg', className)} />;
}

function inTimeWindow(article: NewsArticle, window: TimeWindow): boolean {
  if (window === 'all') return true;
  const ts = Date.parse(article.publishedAt);
  if (Number.isNaN(ts)) return false;
  const now = Date.now();
  const maxAge = window === '24h' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return now - ts <= maxAge;
}

export default function News() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [dataSource, setDataSource] = useState<'newsdata' | 'curated'>('curated');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h');
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [visibleCount, setVisibleCount] = useState(12);

  const [aiSentiment, setAiSentiment] = useState<SentimentResult | null>(null);
  const [aiSentimentLoading, setAiSentimentLoading] = useState(false);
  const [aiBrief, setAiBrief] = useState<AiNewsBrief | null>(null);
  const [aiBriefLoading, setAiBriefLoading] = useState(false);

  const loadNews = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchNews(category === 'all' ? undefined : category);
      setArticles(result.articles);
      setDataSource(result.source);
    } catch (err) {
      console.error('[News] Failed to load:', err);
      setError('Could not load news right now. Showing last available feed when possible.');
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    document.title = 'News — HamaFX';
    loadNews();
  }, [loadNews]);

  const runSentimentAnalysis = useCallback(async () => {
    if (!isGeminiAvailable() || articles.length === 0) return;
    setAiSentimentLoading(true);
    try {
      const headlines = articles.slice(0, 12).map((item) => item.title);
      const result = await getSentimentAnalysis('market', headlines);
      setAiSentiment(result);
    } catch (err) {
      console.warn('[News] Sentiment analysis failed:', err);
    } finally {
      setAiSentimentLoading(false);
    }
  }, [articles]);

  useEffect(() => {
    if (articles.length > 0 && !aiSentiment && isGeminiAvailable()) {
      runSentimentAnalysis();
    }
  }, [articles.length, aiSentiment, runSentimentAnalysis]);

  useEffect(() => {
    if (articles.length === 0) return;
    let active = true;
    setAiBriefLoading(true);
    void getNewsBrief(category).then((brief) => {
      if (active) setAiBrief(brief);
    }).catch((error) => {
      console.warn('[News] AI brief failed:', error);
    }).finally(() => {
      if (active) setAiBriefLoading(false);
    });
    return () => {
      active = false;
    };
  }, [articles.length, category]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = articles.filter((item) => {
      if (!inTimeWindow(item, timeWindow)) return false;

      if (sourceFilter !== 'all') {
        const isCurated = item.source === 'Hama Fx Curated';
        if (sourceFilter === 'curated' && !isCurated) return false;
        if (sourceFilter === 'newsdata' && isCurated) return false;
      }

      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q) ||
        item.relatedAssets?.some((asset) => asset.toLowerCase().includes(q)) === true
      );
    });

    list = [...list].sort((a, b) => {
      if (sortMode === 'latest') return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
      if (sortMode === 'oldest') return Date.parse(a.publishedAt) - Date.parse(b.publishedAt);
      if (sortMode === 'bullish') return (b.sentiment ?? 0) - (a.sentiment ?? 0);
      return (a.sentiment ?? 0) - (b.sentiment ?? 0);
    });

    return list;
  }, [articles, search, sortMode, sourceFilter, timeWindow]);

  const visibleArticles = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  useEffect(() => {
    setVisibleCount(12);
  }, [category, search, sourceFilter, sortMode, timeWindow]);

  const categories: { id: CategoryFilter; label: string; icon: typeof Globe }[] = [
    { id: 'all', label: 'All', icon: Globe },
    { id: 'crypto', label: 'Crypto', icon: TrendingUp },
    { id: 'forex', label: 'Forex', icon: BarChart3 },
    { id: 'economy', label: 'Economy', icon: Newspaper },
  ];

  const bullishCount = filtered.filter((item) => (item.sentiment ?? 0) > 30).length;
  const bearishCount = filtered.filter((item) => (item.sentiment ?? 0) < -30).length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Newspaper className="w-5 h-5 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold">News</h1>
            <p className="text-xs text-slate-500">
              {filtered.length} articles • via {dataSource === 'newsdata' ? 'NewsData.io' : 'Curated Feed'}
              {dataSource === 'curated' && ' (Sample)'}
            </p>
          </div>
        </div>
        <button
          onClick={loadNews}
          aria-label="Refresh news"
          className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-nexus-card border border-nexus-border rounded-lg px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Feed</p>
          <p className="text-xs font-semibold mt-1">{dataSource === 'newsdata' ? 'Live' : 'Curated'}</p>
        </div>
        <div className="bg-nexus-card border border-nexus-border rounded-lg px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Showing</p>
          <p className="text-xs font-semibold mt-1">{visibleArticles.length}/{filtered.length}</p>
        </div>
        <div className="bg-nexus-card border border-nexus-border rounded-lg px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Bullish</p>
          <p className="text-xs font-semibold mt-1 text-emerald-400">{bullishCount}</p>
        </div>
        <div className="bg-nexus-card border border-nexus-border rounded-lg px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Bearish</p>
          <p className="text-xs font-semibold mt-1 text-red-400">{bearishCount}</p>
        </div>
      </div>

      {(aiBriefLoading || aiBrief) && (
        <div className="bg-gradient-to-r from-indigo-600/10 via-nexus-card to-violet-600/10 rounded-xl border border-nexus-border p-4">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-400" /> AI News Brief
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-medium">
              {aiBrief?.source === 'gemini' ? '🤖 Gemini' : '🧠 Copilot'}
            </span>
          </div>
          {aiBriefLoading && !aiBrief ? (
            <div className="space-y-2">
              <div className="animate-shimmer-ai h-5 rounded-md" />
              <div className="animate-shimmer-ai h-12 rounded-md" />
            </div>
          ) : aiBrief ? (
            <>
              <p className="text-sm font-semibold text-slate-100">{aiBrief.headline}</p>
              <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">{aiBrief.summary}</p>
              {aiBrief.themes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {aiBrief.themes.map((theme) => (
                    <span key={theme} className="px-2 py-0.5 rounded-full bg-nexus-elevated text-xs text-slate-400 border border-nexus-border">
                      {theme}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="bg-nexus-elevated/70 border border-nexus-border rounded-lg px-2.5 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Risk</p>
                  <p className="text-xs font-semibold mt-1 capitalize">{aiBrief.riskLevel}</p>
                </div>
                <div className="bg-nexus-elevated/70 border border-nexus-border rounded-lg px-2.5 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Sentiment</p>
                  <p className={cn(
                    'text-xs font-semibold mt-1',
                    aiBrief.sentimentScore > 20 ? 'text-emerald-400' : aiBrief.sentimentScore < -20 ? 'text-red-400' : 'text-amber-400'
                  )}>
                    {aiBrief.sentimentScore > 0 ? '+' : ''}{aiBrief.sentimentScore}
                  </p>
                </div>
                <div className="bg-nexus-elevated/70 border border-nexus-border rounded-lg px-2.5 py-2 col-span-2 sm:col-span-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Ideas</p>
                  <p className="text-xs font-semibold mt-1">{aiBrief.actionableIdeas.length}</p>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {aiSentiment && (
        <div className="bg-gradient-to-r from-violet-600/10 via-nexus-card to-indigo-600/10 rounded-xl border border-nexus-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Bot className="w-4 h-4 text-violet-400" /> Market Sentiment
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-medium">
              🤖 AI-Powered
            </span>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div
              className={cn(
                'text-2xl font-bold font-mono',
                aiSentiment.overallSentiment > 30
                  ? 'text-emerald-400'
                  : aiSentiment.overallSentiment < -30
                  ? 'text-red-400'
                  : 'text-amber-400'
              )}
            >
              {aiSentiment.overallSentiment > 0 ? '+' : ''}
              {aiSentiment.overallSentiment}
            </div>
            <div
              className={cn(
                'px-2.5 py-1 rounded-lg text-sm font-medium capitalize',
                aiSentiment.sentimentLabel.includes('bullish')
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : aiSentiment.sentimentLabel.includes('bearish')
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-amber-500/10 text-amber-400'
              )}
            >
              {aiSentiment.sentimentLabel.replace('_', ' ')}
            </div>
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                aiSentiment.impactAssessment === 'high'
                  ? 'bg-red-500/10 text-red-400'
                  : aiSentiment.impactAssessment === 'medium'
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-slate-500/10 text-slate-400'
              )}
            >
              {aiSentiment.impactAssessment} impact
            </span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{aiSentiment.reasoning}</p>
          {aiSentiment.keyThemes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {aiSentiment.keyThemes.map((theme, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded-full bg-nexus-elevated text-xs text-slate-400 border border-nexus-border">
                  {theme}
                </span>
              ))}
            </div>
          )}
          <p className="text-[9px] text-slate-600 mt-3 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" /> AI-generated sentiment. Not financial advice.
          </p>
        </div>
      )}

      {aiSentimentLoading && !aiSentiment && (
        <div className="bg-nexus-card rounded-xl border border-nexus-border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-400 animate-pulse" />
            <span className="text-sm text-violet-400">Analyzing market sentiment...</span>
          </div>
          <div className="animate-shimmer-ai h-16 rounded-lg" />
        </div>
      )}

      {dataSource === 'curated' && (
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg px-4 py-2.5 flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-blue-400 shrink-0" />
          <p className="text-xs text-blue-300">
            Showing sample news. Add your <span className="font-medium">NewsData.io API key</span> in Settings for live news.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search headlines, source, or symbols..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-nexus-elevated border border-nexus-border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder:text-slate-600"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 md:col-span-2">
            {categories.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setCategory(item.id);
                  setAiSentiment(null);
                }}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-medium capitalize flex items-center gap-1.5 transition-colors whitespace-nowrap',
                  category === item.id
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                    : 'bg-nexus-elevated text-slate-400 border border-nexus-border hover:text-slate-200'
                )}
              >
                <Filter className="w-3 h-3" /> {item.label}
              </button>
            ))}
          </div>

          <select
            aria-label="Sort articles"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="px-3 py-2 rounded-lg bg-nexus-elevated border border-nexus-border text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <option value="latest">Sort: Latest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="bullish">Sort: Most Bullish</option>
            <option value="bearish">Sort: Most Bearish</option>
          </select>

          <div className="flex gap-2">
            <select
              aria-label="Time window"
              value={timeWindow}
              onChange={(event) => setTimeWindow(event.target.value as TimeWindow)}
              className="flex-1 px-3 py-2 rounded-lg bg-nexus-elevated border border-nexus-border text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="24h">24h</option>
              <option value="7d">7d</option>
              <option value="all">All time</option>
            </select>
            <select
              aria-label="Source filter"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
              className="flex-1 px-3 py-2 rounded-lg bg-nexus-elevated border border-nexus-border text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="all">All sources</option>
              <option value="newsdata">Live only</option>
              <option value="curated">Curated only</option>
            </select>
          </div>
        </div>
      </div>

      {loading && articles.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Shimmer key={idx} className="h-28 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-nexus-card rounded-xl border border-nexus-border p-8 text-center">
          <ArrowDownAZ className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-300">No articles match this filter set.</p>
          <p className="text-xs text-slate-500 mt-1">Try switching time window, source, or search terms.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {visibleArticles.map((article) => (
              <article
                key={article.id}
                className="bg-nexus-card rounded-xl border border-nexus-border overflow-hidden hover:border-blue-500/20 transition-colors"
              >
                <div className="flex">
                  {article.imageUrl && (
                    <div className="hidden sm:block w-40 h-32 shrink-0">
                      <img
                        src={article.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(event) => {
                          (event.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span
                            className={cn(
                              'text-[10px] px-2 py-0.5 rounded-full font-medium capitalize',
                              article.category === 'crypto'
                                ? 'bg-amber-500/10 text-amber-400'
                                : article.category === 'forex'
                                ? 'bg-blue-500/10 text-blue-400'
                                : article.category === 'economy'
                                ? 'bg-purple-500/10 text-purple-400'
                                : 'bg-slate-500/10 text-slate-400'
                            )}
                          >
                            {article.category}
                          </span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {timeAgo(article.publishedAt)}
                          </span>
                          <span className="text-[10px] text-slate-600">{article.source}</span>
                        </div>

                        <h3 className="text-sm font-semibold leading-tight line-clamp-2 mb-1.5">
                          {article.url !== '#' ? (
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-blue-400 transition-colors"
                            >
                              {article.title}
                              <ExternalLink className="w-3 h-3 inline ml-1 text-slate-500" />
                            </a>
                          ) : (
                            article.title
                          )}
                        </h3>

                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{article.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {article.sentiment !== undefined && (
                          <SentimentBadge sentiment={article.sentiment} source={article.sentimentSource} />
                        )}
                        {article.relatedAssets && article.relatedAssets.length > 0 && (
                          <div className="flex items-center gap-1">
                            {article.relatedAssets.slice(0, 3).map((asset) => (
                              <span key={asset} className="text-[10px] px-1.5 py-0.5 rounded bg-nexus-elevated text-slate-500 capitalize">
                                {asset}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {visibleCount < filtered.length && (
            <div className="flex justify-center">
              <button
                onClick={() => setVisibleCount((count) => count + 12)}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-nexus-elevated border border-nexus-border text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <Flame className="w-3 h-3" /> Load more
              </button>
            </div>
          )}
        </>
      )}

      <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-500 leading-relaxed">
            News and sentiment analysis are informational only and not financial advice.
            {dataSource === 'curated' && ' Sample data shown — add NewsData.io key for live news.'}
          </p>
        </div>
      </div>
    </div>
  );
}
