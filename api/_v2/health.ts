import { sql } from 'drizzle-orm';
import { getDb } from '../_lib/db/client.js';
import { getEnvValidationStatus } from '../_lib/env.js';
import { handleApi } from '../_lib/handler.js';
import { methodNotAllowed, ok } from '../_lib/http.js';
import { getRedis } from '../_lib/redis.js';
import { handleOptions } from '../_lib/request.js';

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const envStatus = getEnvValidationStatus();

    let dbOk = false;
    let dbError: string | null = null;
    try {
      const db = getDb();
      await db.execute(sql`select 1`);
      dbOk = true;
    } catch (error) {
      dbError = error instanceof Error ? error.message : 'DB check failed';
    }

    let redisOk = false;
    let redisError: string | null = null;
    try {
      const redis = getRedis();
      if (redis) {
        await redis.ping();
        redisOk = true;
      }
    } catch (error) {
      redisError = error instanceof Error ? error.message : 'Redis check failed';
    }

    const healthy = envStatus.ok && dbOk;
    return ok({
      service: 'hamafx-api-v2',
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      env: envStatus,
      dependencies: {
        postgres: { ok: dbOk, error: dbError },
        redis: { ok: redisOk, error: redisError },
      },
    });
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
