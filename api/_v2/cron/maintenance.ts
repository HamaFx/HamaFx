import { and, isNotNull, lt, sql } from 'drizzle-orm';
import { getDb, schema } from '../../_lib/db/client.js';
import { getEnv } from '../../_lib/env.js';
import { handleApi } from '../../_lib/handler.js';
import { fail, methodNotAllowed, ok } from '../../_lib/http.js';
import { handleOptions } from '../../_lib/request.js';
import { getRedis } from '../../_lib/redis.js';

function isAuthorized(request: Request): boolean {
  const env = getEnv();
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${env.CRON_SECRET}`) return true;

  // Vercel Cron may pass raw secret header in some setups
  const cronHeader = request.headers.get('x-cron-secret');
  return cronHeader === env.CRON_SECRET;
}

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    if (!isAuthorized(request)) return fail('Forbidden', 403);

    const db = getDb();
    const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);

    const deletedRevoked = await db
      .delete(schema.sessions)
      .where(and(isNotNull(schema.sessions.revokedAt), lt(schema.sessions.revokedAt, cutoff)))
      .returning({ id: schema.sessions.id });

    const deletedExpired = await db
      .delete(schema.sessions)
      .where(lt(schema.sessions.expiresAt, new Date()))
      .returning({ id: schema.sessions.id });

    // Keep only last 200 chat messages per user via SQL window function
    await db.execute(sql`
      delete from chat_messages
      where id in (
        select id from (
          select id,
                 row_number() over (partition by user_id order by timestamp desc) as rn
          from chat_messages
        ) ranked
        where ranked.rn > 200
      )
    `);

    // Optional cache cleanup prefix pattern in Redis
    const redis = getRedis();
    if (redis) {
      const keys = await redis.keys('rate:*');
      if (keys.length > 5000) {
        for (const key of keys.slice(0, keys.length - 5000)) {
          await redis.del(key);
        }
      }
    }

    return ok({
      maintenance: true,
      deletedRevokedSessions: deletedRevoked.length,
      deletedExpiredSessions: deletedExpired.length,
      ranAt: new Date().toISOString(),
    });
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => methodNotAllowed(request.method));
}
