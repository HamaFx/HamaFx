type SentryLevel = 'error' | 'warning' | 'info';

type SentryConfig = {
  dsn: string;
  environment?: string;
  release?: string;
};

type ParsedDsn = {
  dsn: string;
  envelopeUrl: string;
};

let sentryConfig: SentryConfig | null = null;
let parsedDsnConfig: ParsedDsn | null = null;

function createEventId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.slice(0, 32);
}

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

function eventFromUnknown(error: unknown, level: SentryLevel) {
  const isError = error instanceof Error;
  const eventId = createEventId();

  return {
    event_id: eventId,
    level,
    message: isError ? error.message : String(error),
    exception: {
      values: [
        {
          type: isError ? error.name : 'Error',
          value: isError ? error.message : String(error),
          stacktrace: isError && error.stack
            ? {
                frames: error.stack
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line) => ({ filename: line })),
              }
            : undefined,
        },
      ],
    },
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    request: {
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      headers: {
        'User-Agent': typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      },
    },
    tags: {
      source: 'frontend',
    },
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

async function sendEvent(event: Record<string, unknown>) {
  if (!sentryConfig || !parsedDsnConfig) return;

  try {
    await fetch(parsedDsnConfig.envelopeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
      },
      body: toEnvelope(
        {
          ...event,
          environment: sentryConfig.environment,
          release: sentryConfig.release,
        },
        parsedDsnConfig.dsn
      ),
      keepalive: true,
    });
  } catch {
    // Never throw from observability hooks.
  }
}

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  try {
    parsedDsnConfig = parseDsn(dsn);
  } catch {
    return;
  }

  sentryConfig = {
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE,
  };

  window.addEventListener('error', (event) => {
    void sendEvent(eventFromUnknown(event.error ?? event.message, 'error'));
  });

  window.addEventListener('unhandledrejection', (event) => {
    void sendEvent(eventFromUnknown(event.reason, 'error'));
  });
}

export function captureException(error: unknown, level: SentryLevel = 'error') {
  void sendEvent(eventFromUnknown(error, level));
}
