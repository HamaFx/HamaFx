import { z } from 'zod';

const envSchema = z.object({
  AUTH_JWT_SECRET: z.string().min(16),
  DATABASE_URL: z.string().min(10),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(10).optional(),
  CRON_SECRET: z.string().min(12),
  CORS_ALLOWED_ORIGIN: z.string().url(),
  NEWSDATA_API_KEY: z.string().optional(),
  COINGECKO_API_KEY: z.string().optional(),
  PROTECTION_BYPASS_SECRET: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
    throw new Error(`Environment validation failed: ${details}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getEnvValidationStatus() {
  const parsed = envSchema.safeParse(process.env);
  if (parsed.success) {
    return { ok: true as const, missing: [] as string[] };
  }

  const missing = parsed.error.issues.map((issue) => issue.path.join('.'));
  return { ok: false as const, missing };
}
