import { Redis } from '@upstash/redis';
import { getEnv } from './env';

let redis: Redis | null = null;

function canUseRedis(): boolean {
  try {
    const env = getEnv();
    return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
  } catch {
    return false;
  }
}

export function getRedis(): Redis | null {
  if (!canUseRedis()) return null;
  if (redis) return redis;

  const env = getEnv();
  redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return redis;
}

export async function withRedisCache<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const client = getRedis();
  if (!client) return fn();

  const hit = await client.get<T>(key);
  if (hit !== null && hit !== undefined) return hit;

  const data = await fn();
  await client.set(key, data, { ex: ttlSeconds });
  return data;
}

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const client = getRedis();
  if (!client) return true;

  const redisKey = `rate:${key}`;
  const tx = client.multi();
  tx.incr(redisKey);
  tx.expire(redisKey, windowSeconds);
  const result = await tx.exec();
  const count = Number(result?.[0] ?? 0);
  return count <= limit;
}
