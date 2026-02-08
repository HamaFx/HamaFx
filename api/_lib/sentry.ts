import * as Sentry from '@sentry/node';
import { getEnv } from './env.js';

let initialized = false;

function toSampleRate(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed < 0 || parsed > 1) return undefined;
  return parsed;
}

function loadSentryConfig() {
  try {
    const env = getEnv();
    if (!env.SENTRY_DSN) return null;

    return {
      dsn: env.SENTRY_DSN,
      environment: env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || env.NODE_ENV,
      tracesSampleRate: toSampleRate(env.SENTRY_TRACES_SAMPLE_RATE),
    };
  } catch {
    return null;
  }
}

export function initServerSentry() {
  if (initialized) return;

  const config = loadSentryConfig();
  if (!config) return;

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    tracesSampleRate: config.tracesSampleRate,
  });

  initialized = true;
}

export function captureApiException(error: unknown, request: Request) {
  initServerSentry();
  if (!Sentry.getClient()) return;

  Sentry.withScope((scope) => {
    const url = new URL(request.url);

    scope.setTag('runtime', 'vercel-node');
    scope.setTag('api.method', request.method);
    scope.setTag('api.path', url.pathname);

    const requestId = request.headers.get('x-request-id');
    if (requestId) {
      scope.setTag('request_id', requestId);
    }

    const userAgent = request.headers.get('user-agent');
    if (userAgent) {
      scope.setContext('request', {
        userAgent,
      });
    }

    if (error instanceof Error) {
      Sentry.captureException(error);
      return;
    }

    Sentry.captureException(new Error(String(error)));
  });
}
