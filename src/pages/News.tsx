import { useEffect, useState, useCallback } from 'react';
import {
  Newspaper, Search, Filter, TrendingUp, TrendingDown, Minus,
  ExternalLink, Bot, BarChart3, RefreshCw, AlertTriangle, Clock, Globe
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { fetchNews } from '@/services/newsService';
import { getSentimentAnalysis, isGeminiAvailable, keywordSentiment } from '@/services/gemini';
import { useSettingsStore } from '@/stores/settingsStore';
import type { NewsArticle, SentimentResult } from '@/types';

type CategoryFilter = 'all' | 'crypto' | 'forex' | 'economy' | 'general';

function SentimentBadge({ sentiment, source }: { sentiment: number; source?: string }) {
  const label = sentiment > 30 ? 'Bullish' : sentiment < -30 ? 'Bearish' : 'Neutral';
  const color = sentiment > 30 ? 'text-emerald-400 bg-emerald-500/10' :
                sentiment < -30 ? 'text-red-400 bg-red-500/10' :
                'text-amber-400 bg-amber-500/10';
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
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function Shimmer({ className }: { className?: string }) {
  return <div className={cn('animate-shimmer rounded-lg', className)} />;
}

export default function News() {
  const { hasGeminiKey } = useSettingsStore();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [dataSource, setDataSource] = useState<'newsdata' | 'curated'>('curated');
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [aiSentiment, setAiSentiment] = useState<SentimentResult | null>(null);
  const [aiSentimentLoading, setAiSentimentLoading] = useState(false);

  const loadNews = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchNews(category === 'all' ? undefined : category);
      setArticles(result.articles);
      setDataSource(result.source);
    } catch (err) {
      console.error('[News] Failed to load:', err);
    }
    setLoading(false);
  }, [category]);

  useEffect(() => {
    document.title = 'News — HamaFX';
    loadNews();
  }, [loadNews]);

  // Run AI sentiment analysis on loaded headlines
  const runSentimentAnalysis = useCallback(async () => {
    if (!isGeminiAvailable() || articles.length === 0) return;
    setAiSentimentLoading(true);
    try {
      const headlines = articles.slice(0, 10).map(a => a.title);
      const result = await getSentimentAnalysis('market', headlines);
      setAiSentiment(result);

      // Update article sentiments with AI
      if (result.source === 'gemini') {
        setArticles(prev => prev.map(a => ({
          ...a,
          sentiment: keywordSentiment(a.title), // Re-score individually
          sentimentSource: 'keyword' as const, // Individual articles stay keyword-based
        })));
      }
    } catch (err) {
      console.warn('[News] Sentiment analysis failed:', err);
    }
    setAiSentimentLoading(false);
  }, [articles]);

  useEffect(() => {
    if (articles.length > 0 && !aiSentiment && hasGeminiKey()) {
      runSentimentAnalysis();
    }
  }, [articles.length, aiSentiment, hasGeminiKey, runSentimentAnalysis]);

  const filtered = articles.filter(a => {
    if (search) {
      const q = search.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
    }
    return true;
  });

  const categories: { id: CategoryFilter; label: string; icon: typeof Globe }[] = [
    { id: 'all', label: 'All', icon: Globe },
    { id: 'crypto', label: 'Crypto', icon: TrendingUp },
    { id: 'forex', label: 'Forex', icon: BarChart3 },
    { id: 'economy', label: 'Economy', icon: Newspaper },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
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
          className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* AI Sentiment Overview */}
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
            <div className={cn(
              'text-2xl font-bold font-mono',
              aiSentiment.overallSentiment > 30 ? 'text-emerald-400' :
              aiSentiment.overallSentiment < -30 ? 'text-red-400' :
              'text-amber-400'
            )}>
              {aiSentiment.overallSentiment > 0 ? '+' : ''}{aiSentiment.overallSentiment}
            </div>
            <div className={cn(
              'px-2.5 py-1 rounded-lg text-sm font-medium capitalize',
              aiSentiment.sentimentLabel.includes('bullish') ? 'bg-emerald-500/10 text-emerald-400' :
              aiSentiment.sentimentLabel.includes('bearish') ? 'bg-red-500/10 text-red-400' :
              'bg-amber-500/10 text-amber-400'
            )}>
              {aiSentiment.sentimentLabel.replace('_', ' ')}
            </div>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              aiSentiment.impactAssessment === 'high' ? 'bg-red-500/10 text-red-400' :
              aiSentiment.impactAssessment === 'medium' ? 'bg-amber-500/10 text-amber-400' :
              'bg-slate-500/10 text-slate-400'
            )}>
              {aiSentiment.impactAssessment} impact
            </span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{aiSentiment.reasoning}</p>
          {aiSentiment.keyThemes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {aiSentiment.keyThemes.map((theme, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-nexus-elevated text-xs text-slate-400 border border-nexus-border">
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

      {/* Loading sentiment */}
      {aiSentimentLoading && !aiSentiment && (
        <div className="bg-nexus-card rounded-xl border border-nexus-border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-400 animate-pulse" />
            <span className="text-sm text-violet-400">Analyzing market sentiment...</span>
          </div>
          <div className="animate-shimmer-ai h-16 rounded-lg" />
        </div>
      )}

      {/* Curated data notice */}
      {dataSource === 'curated' && (
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg px-4 py-2.5 flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-blue-400 shrink-0" />
          <p className="text-xs text-blue-300">
            Showing sample news. Add your <span className="font-medium">NewsData.io API key</span> in Settings for live news.
          </p>
        </div>
      )}

      {/* Search + Category Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search news..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-nexus-elevated border border-nexus-border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder:text-slate-600"
          />
        </div>
        <div className="flex gap-1.5">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setCategory(cat.id); setAiSentiment(null); }}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-medium capitalize flex items-center gap-1.5 transition-colors',
                category === cat.id
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  : 'bg-nexus-elevated text-slate-400 border border-nexus-border hover:text-slate-200'
              )}
            >
              <Filter className="w-3 h-3" /> {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* News List */}
      {loading && articles.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Shimmer key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-nexus-card rounded-xl border border-nexus-border p-8 text-center">
          <Newspaper className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No articles match your search</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(article => (
            <article
              key={article.id}
              className="bg-nexus-card rounded-xl border border-nexus-border overflow-hidden hover:border-blue-500/20 transition-colors"
            >
              <div className="flex">
                {/* Image (if available) */}
                {article.imageUrl && (
                  <div className="hidden sm:block w-40 h-32 shrink-0">
                    <img
                      src={article.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}

                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-medium capitalize',
                          article.category === 'crypto' ? 'bg-amber-500/10 text-amber-400' :
                          article.category === 'forex' ? 'bg-blue-500/10 text-blue-400' :
                          article.category === 'economy' ? 'bg-purple-500/10 text-purple-400' :
                          'bg-slate-500/10 text-slate-400'
                        )}>
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

                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {article.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      {article.sentiment !== undefined && (
                        <SentimentBadge
                          sentiment={article.sentiment}
                          source={article.sentimentSource}
                        />
                      )}
                      {article.relatedAssets && article.relatedAssets.length > 0 && (
                        <div className="flex items-center gap-1">
                          {article.relatedAssets.slice(0, 3).map(asset => (
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
      )}

      {/* Risk Disclaimer */}
      <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-500 leading-relaxed">
            News and sentiment analysis are for informational purposes only. Not financial advice.
            {dataSource === 'curated' && ' Sample data shown — add NewsData.io key for live news.'}
          </p>
        </div>
      </div>
    </div>
  );
}
