import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getEnv } from '../env.js';
import * as schema from './schema.js';

let cachedClient: ReturnType<typeof postgres> | null = null;
let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getSqlClient() {
  if (cachedClient) return cachedClient;
  const env = getEnv();
  cachedClient = postgres(env.DATABASE_URL, {
    prepare: true,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return cachedClient;
}

export function getDb() {
  if (cachedDb) return cachedDb;
  cachedDb = drizzle(getSqlClient(), { schema });
  return cachedDb;
}

export { schema };
