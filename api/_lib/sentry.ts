import { randomUUID } from 'node:crypto';

type SentryLevel = 'error' | 'warning' | 'info';

type CaptureContext = {
  request?: Request;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

type ParsedDsn = {
  dsn: string;
  envelopeUrl: string;
};

const sentryDsn = process.env.SENTRY_DSN;
const sentryEnvironment = process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV;
const sentryRelease = process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA;

function parseDsn(dsn: string): ParsedDsn {
  const parsed = new URL(dsn);
  const path = parsed.pathname.replace(/\/+$/, '');
  const lastSlash = path.lastIndexOf('/');
  const projectId = path.slice(lastSlash + 1);
  const pathPrefix = path.slice(0, lastSlash);

  if (!projectId) {
    throw new Error('Invalid Sentry DSN: missing project id');
  }

  return {
    dsn,
    envelopeUrl: `${parsed.protocol}//${parsed.host}${pathPrefix}/api/${projectId}/envelope/`,
  };
}

function buildEvent(error: unknown, level: SentryLevel, context: CaptureContext) {
  const normalized = error instanceof Error ? error : new Error(String(error));

  return {
    event_id: randomUUID().replace(/-/g, '').slice(0, 32),
    level,
    message: normalized.message,
    timestamp: new Date().toISOString(),
    platform: 'node',
    environment: sentryEnvironment,
    release: sentryRelease,
    exception: {
      values: [
        {
          type: normalized.name,
          value: normalized.message,
          stacktrace: normalized.stack
            ? {
                frames: normalized.stack
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line) => ({ filename: line })),
              }
            : undefined,
        },
      ],
    },
    request: context.request
      ? {
          method: context.request.method,
          url: context.request.url,
        }
      : undefined,
    tags: {
      runtime: 'vercel-function',
      ...context.tags,
    },
    extra: context.extra,
  };
}

function toEnvelope(event: Record<string, unknown>, dsn: string) {
  const envelopeHeaders = {
    event_id: event.event_id,
    sent_at: new Date().toISOString(),
    dsn,
  };

  const itemHeaders = { type: 'event' };
  return `${JSON.stringify(envelopeHeaders)}\n${JSON.stringify(itemHeaders)}\n${JSON.stringify(event)}`;
}

export async function captureException(
  error: unknown,
  context: CaptureContext = {},
  level: SentryLevel = 'error'
): Promise<void> {
  if (!sentryDsn) return;

  try {
    const parsed = parseDsn(sentryDsn);
    const event = buildEvent(error, level, context);

    await fetch(parsed.envelopeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
      },
      body: toEnvelope(event, parsed.dsn),
    });
  } catch {
    // Never fail requests due to monitoring issues.
  }
}
