import { z } from 'zod';

const envSchema = z.object({
  AUTH_JWT_SECRET: z.string().trim().min(16),
  DATABASE_URL: z.string().trim().min(10),
  UPSTASH_REDIS_REST_URL: z.string().trim().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().trim().min(10).optional(),
  CRON_SECRET: z.string().trim().min(12),
  CORS_ALLOWED_ORIGIN: z.string().trim().url(),
  NEWSDATA_API_KEY: z.string().trim().optional(),
  COINGECKO_API_KEY: z.string().trim().optional(),
  ALPHA_VANTAGE_API_KEY: z.string().trim().optional(),
  GEMINI_API_KEY: z.string().trim().optional(),
  GROQ_API_KEY: z.string().trim().optional(),
  GROQ_MODEL: z.string().trim().optional(),
  SCITELY_API_KEY: z.string().trim().optional(),
  SCITELY_MODEL: z.string().trim().optional(),
  AI_PROVIDER: z.string().trim().pipe(z.enum(['auto', 'gemini', 'groq', 'scitely'])).optional(),
  SENTRY_DSN: z.string().trim().optional(),
  SENTRY_ENVIRONMENT: z.string().trim().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.string().trim().optional(),
  PROTECTION_BYPASS_SECRET: z.string().trim().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

function stripSurroundingQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function normalizeProcessEnv(source: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(source)) {
    normalized[key] = typeof value === 'string'
      ? stripSurroundingQuotes(value.trim())
      : value;
  }
  return normalized;
}

export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(normalizeProcessEnv(process.env));
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
    throw new Error(`Environment validation failed: ${details}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getEnvValidationStatus() {
  const parsed = envSchema.safeParse(normalizeProcessEnv(process.env));
  if (parsed.success) {
    return { ok: true as const, missing: [] as string[] };
  }

  const missing = parsed.error.issues.map((issue) => issue.path.join('.'));
  return { ok: false as const, missing };
}
