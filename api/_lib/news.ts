import { getEnv } from './env';
import { withRedisCache } from './redis';

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function curatedNews() {
  return [
    {
      id: 'curated-1',
      title: 'Bitcoin re-tests breakout zone as volumes rise',
      description: 'Crypto majors are consolidating after a strong breakout while ETF flows remain supportive.',
      source: 'Hama Fx Curated',
      url: '#',
      publishedAt: hoursAgo(1),
      category: 'crypto',
    },
    {
      id: 'curated-2',
      title: 'Dollar mixed before key macro releases',
      description: 'FX majors are range-bound as traders price incoming inflation and labor data.',
      source: 'Hama Fx Curated',
      url: '#',
      publishedAt: hoursAgo(2),
      category: 'forex',
    },
    {
      id: 'curated-3',
      title: 'Risk sentiment improves after central bank commentary',
      description: 'Equities and digital assets gained after policy makers signaled a data-dependent stance.',
      source: 'Hama Fx Curated',
      url: '#',
      publishedAt: hoursAgo(4),
      category: 'economy',
    },
  ];
}

export async function getNews(category = 'all') {
  return withRedisCache(`news:${category}`, 120, async () => {
    const env = getEnv();
    if (!env.NEWSDATA_API_KEY) {
      const data = curatedNews();
      return category === 'all' ? data : data.filter((item) => item.category === category);
    }

    const url = new URL('https://newsdata.io/api/1/latest');
    url.searchParams.set('apikey', env.NEWSDATA_API_KEY);
    url.searchParams.set('language', 'en');
    url.searchParams.set('size', '20');
    if (category === 'crypto') url.searchParams.set('q', 'crypto OR bitcoin OR ethereum');
    if (category === 'forex') url.searchParams.set('q', 'forex OR currency OR dollar OR euro');
    if (category === 'economy') url.searchParams.set('q', 'economy OR inflation OR central bank');

    const response = await fetch(url);
    if (!response.ok) {
      const data = curatedNews();
      return category === 'all' ? data : data.filter((item) => item.category === category);
    }

    const payload = await response.json();
    const normalized = Array.isArray(payload?.results)
      ? payload.results.map((item: Record<string, unknown>, idx: number) => ({
          id: String(item.article_id ?? `news-${idx}`),
          title: String(item.title ?? ''),
          description: String(item.description ?? ''),
          source: String(item.source_name ?? 'Unknown'),
          url: String(item.link ?? '#'),
          imageUrl: item.image_url ? String(item.image_url) : undefined,
          publishedAt: String(item.pubDate ?? new Date().toISOString()),
          category: category === 'all' ? 'general' : category,
        }))
      : [];

    return normalized;
  });
}
