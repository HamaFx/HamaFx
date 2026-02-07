// News Service — backend/newsdata (primary) + curated fallback
// Adds normalization, deduping, sorting, and stale-cache resilience.

import type { NewsArticle } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';
import { cacheService } from '@/services/cache';
import { rateLimiter } from '@/services/rateLimiter';
import { getCuratedNews } from '@/data/curatedNews';
import { keywordSentiment } from '@/services/gemini';
import { isBackendEnabled } from '@/services/backend/config';
import { backendFetch } from '@/services/backend/http';

const NEWSDATA_URL = 'https://newsdata.io/api/1/news';

type NewsSource = 'newsdata' | 'curated';
type NewsResult = { articles: NewsArticle[]; source: NewsSource };

function getNewsApiKey(): string | null {
  return useSettingsStore.getState().getNewsApiKey();
}

function normalizeText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function truncate(value: string, max = 240): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function normalizeArticle(raw: Partial<NewsArticle>, fallbackId: string): NewsArticle | null {
  const title = normalizeText(raw.title);
  if (!title) return null;

  const description = truncate(normalizeText(raw.description) || 'No summary available.');
  const source = normalizeText(raw.source) || 'Unknown';
  const url = normalizeText(raw.url) || '#';

  const publishedAtRaw = normalizeText(raw.publishedAt);
  const parsed = publishedAtRaw ? Date.parse(publishedAtRaw) : NaN;
  const publishedAt = Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();

  const category = raw.category ?? detectCategory(title);

  return {
    id: normalizeText(raw.id) || fallbackId,
    title,
    description,
    source,
    url,
    imageUrl: raw.imageUrl,
    publishedAt,
    category,
    sentiment: typeof raw.sentiment === 'number' ? raw.sentiment : keywordSentiment(title),
    sentimentSource: raw.sentimentSource ?? 'keyword',
    relatedAssets: Array.isArray(raw.relatedAssets) ? raw.relatedAssets : undefined,
  };
}

function dedupeAndSort(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const out: NewsArticle[] = [];

  for (const item of articles) {
    const dedupeKey = `${item.url.toLowerCase()}::${item.title.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(item);
  }

  return out.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

function classifySource(articles: NewsArticle[]): NewsSource {
  return articles.some((item) => item.source === 'Hama Fx Curated') ? 'curated' : 'newsdata';
}

function normalizeResult(articles: NewsArticle[], source: NewsSource): NewsResult {
  return {
    articles: dedupeAndSort(articles).slice(0, 40),
    source,
  };
}

function curatedResult(category?: string): NewsResult {
  const filtered = getCuratedNews().filter((item) => !category || category === 'all' || item.category === category);
  return normalizeResult(filtered, 'curated');
}

export async function fetchNews(category?: string): Promise<NewsResult> {
  const requested = category && category !== 'all' ? category : 'all';
  const cacheKey = `news_${requested}`;

  const cached = cacheService.get<NewsResult>(cacheKey);
  if (cached) return cached;

  if (isBackendEnabled()) {
    try {
      const rawArticles = await backendFetch<NewsArticle[]>(`/api/v2/news?category=${encodeURIComponent(requested)}`);
      const normalized = rawArticles
        .map((item, idx) => normalizeArticle(item, `backend-${idx}-${Date.now()}`))
        .filter((item): item is NewsArticle => item !== null);

      if (normalized.length > 0) {
        const result = normalizeResult(normalized, classifySource(normalized));
        cacheService.set(cacheKey, result, 180_000);
        return result;
      }
    } catch (err) {
      console.warn('[News] Backend news fetch failed:', err);
    }
  }

  const apiKey = getNewsApiKey();

  if (apiKey && rateLimiter.canMakeRequest('newsdata')) {
    try {
      rateLimiter.recordRequest('newsdata');
      const params = new URLSearchParams({
        apikey: apiKey,
        language: 'en',
        category: 'business',
        q: requested === 'crypto'
          ? 'cryptocurrency OR bitcoin OR ethereum OR blockchain'
          : requested === 'forex'
          ? 'forex OR currency OR exchange rate OR central bank'
          : requested === 'economy'
          ? 'inflation OR gdp OR central bank OR employment'
          : 'forex OR cryptocurrency OR financial markets OR central bank',
      });

      const response = await fetch(`${NEWSDATA_URL}?${params}`);
      if (response.ok) {
        const payload = await response.json();
        if (Array.isArray(payload?.results)) {
          const normalized = payload.results
            .map((item: Record<string, unknown>, idx: number) =>
              normalizeArticle(
                {
                  id: String(item.article_id ?? `nd-${idx}`),
                  title: item.title as string,
                  description: (item.description as string) || (item.content as string),
                  source: (item.source_name as string) || (item.source_id as string),
                  url: item.link as string,
                  imageUrl: item.image_url as string,
                  publishedAt: item.pubDate as string,
                  category: requested === 'all' ? detectCategory(String(item.title ?? '')) : (requested as NewsArticle['category']),
                },
                `nd-${idx}-${Date.now()}`
              )
            )
            .filter((item: NewsArticle | null): item is NewsArticle => item !== null);

          if (normalized.length > 0) {
            const result = normalizeResult(normalized, 'newsdata');
            cacheService.set(cacheKey, result, 300_000);
            return result;
          }
        }
      }
    } catch (err) {
      console.warn('[News] NewsData.io fetch failed:', err);
    }
  }

  const stale = cacheService.getStale<NewsResult>(cacheKey);
  if (stale?.articles?.length) {
    return normalizeResult(stale.articles, stale.source);
  }

  const fallback = curatedResult(requested);
  cacheService.set(cacheKey, fallback, 120_000);
  return fallback;
}

export async function fetchNewsByAsset(assetId: string): Promise<NewsArticle[]> {
  const needle = assetId.toLowerCase();
  const { articles } = await fetchNews();
  return articles.filter((item) =>
    item.relatedAssets?.includes(needle) ||
    item.title.toLowerCase().includes(needle) ||
    item.description.toLowerCase().includes(needle)
  );
}

function detectCategory(title: string): NewsArticle['category'] {
  const lower = title.toLowerCase();
  if (
    lower.includes('bitcoin') ||
    lower.includes('crypto') ||
    lower.includes('ethereum') ||
    lower.includes('blockchain') ||
    lower.includes('defi') ||
    lower.includes('token')
  ) {
    return 'crypto';
  }
  if (
    lower.includes('forex') ||
    lower.includes('currency') ||
    lower.includes('eur/usd') ||
    lower.includes('dollar') ||
    lower.includes('yen') ||
    lower.includes('pound')
  ) {
    return 'forex';
  }
  if (
    lower.includes('gdp') ||
    lower.includes('inflation') ||
    lower.includes('fed') ||
    lower.includes('interest rate') ||
    lower.includes('employment') ||
    lower.includes('economic')
  ) {
    return 'economy';
  }
  return 'general';
}
