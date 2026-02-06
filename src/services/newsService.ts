// News Service — NewsData.io (primary) + Curated fallback
// Uses user-provided API key from Settings
// Falls back to curated news when no key

import type { NewsArticle } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';
import { cacheService } from '@/services/cache';
import { rateLimiter } from '@/services/rateLimiter';
import { getCuratedNews } from '@/data/curatedNews';
import { keywordSentiment } from '@/services/gemini';

const NEWSDATA_URL = 'https://newsdata.io/api/1/news';

function getNewsApiKey(): string | null {
  return useSettingsStore.getState().getNewsApiKey();
}

export async function fetchNews(category?: string): Promise<{ articles: NewsArticle[]; source: 'newsdata' | 'curated' }> {
  const cacheKey = `news_${category || 'all'}`;
  const cached = cacheService.get<{ articles: NewsArticle[]; source: 'newsdata' | 'curated' }>(cacheKey);
  if (cached) return cached;

  const apiKey = getNewsApiKey();

  // Try NewsData.io if key is available
  if (apiKey && rateLimiter.canMakeRequest('newsdata')) {
    try {
      rateLimiter.recordRequest('newsdata');
      const params = new URLSearchParams({
        apikey: apiKey,
        language: 'en',
        category: 'business',
        q: category === 'crypto' ? 'cryptocurrency OR bitcoin OR ethereum' :
           category === 'forex' ? 'forex OR currency OR exchange rate' :
           'forex OR cryptocurrency OR financial markets',
      });

      const res = await fetch(`${NEWSDATA_URL}?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.results && Array.isArray(data.results)) {
          const articles: NewsArticle[] = data.results.slice(0, 20).map((item: Record<string, unknown>, i: number) => ({
            id: `nd-${i}-${Date.now()}`,
            title: (item.title as string) || 'Untitled',
            description: (item.description as string) || (item.content as string)?.substring(0, 200) || '',
            source: (item.source_name as string) || (item.source_id as string) || 'NewsData',
            url: (item.link as string) || '#',
            imageUrl: (item.image_url as string) || undefined,
            publishedAt: (item.pubDate as string) || new Date().toISOString(),
            category: detectCategory((item.title as string) || ''),
            sentiment: keywordSentiment((item.title as string) || ''),
            sentimentSource: 'keyword' as const,
          }));

          const result = { articles, source: 'newsdata' as const };
          cacheService.set(cacheKey, result, 300_000); // 5 min cache
          return result;
        }
      }
    } catch (err) {
      console.warn('[News] NewsData.io fetch failed:', err);
    }
  }

  // Fallback to curated news
  let articles = getCuratedNews();
  if (category && category !== 'all') {
    articles = articles.filter(a => a.category === category);
  }
  const result = { articles, source: 'curated' as const };
  cacheService.set(cacheKey, result, 60_000); // 1 min cache for curated
  return result;
}

export async function fetchNewsByAsset(assetId: string): Promise<NewsArticle[]> {
  const { articles } = await fetchNews();
  return articles.filter(a =>
    a.relatedAssets?.includes(assetId) ||
    a.title.toLowerCase().includes(assetId.toLowerCase()) ||
    a.description.toLowerCase().includes(assetId.toLowerCase())
  );
}

function detectCategory(title: string): NewsArticle['category'] {
  const lower = title.toLowerCase();
  if (lower.includes('bitcoin') || lower.includes('crypto') || lower.includes('ethereum') ||
      lower.includes('blockchain') || lower.includes('defi') || lower.includes('token')) {
    return 'crypto';
  }
  if (lower.includes('forex') || lower.includes('currency') || lower.includes('eur/usd') ||
      lower.includes('dollar') || lower.includes('yen') || lower.includes('pound')) {
    return 'forex';
  }
  if (lower.includes('gdp') || lower.includes('inflation') || lower.includes('fed') ||
      lower.includes('interest rate') || lower.includes('employment') || lower.includes('economic')) {
    return 'economy';
  }
  return 'general';
}
