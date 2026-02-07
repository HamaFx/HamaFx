import { isBackendEnabled } from './config';

const TOKEN_KEY = 'hamafx_api_token';
let refreshing: Promise<string | null> | null = null;

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null) {
  try {
    if (!token) {
      localStorage.removeItem(TOKEN_KEY);
      return;
    }
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignore storage failures
  }
}

function withDefaultHeaders(headers?: HeadersInit): Headers {
  const out = new Headers(headers ?? {});
  if (!out.has('content-type')) {
    out.set('content-type', 'application/json');
  }

  const bypass = import.meta.env.PLAYWRIGHT_PROTECTION_BYPASS as string | undefined;
  if (bypass && !out.has('x-vercel-protection-bypass')) {
    out.set('x-vercel-protection-bypass', bypass);
  }

  return out;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const response = await fetch('/api/v2/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        setAccessToken(null);
        return null;
      }

      const payload = await response.json();
      const token = payload?.data?.token as string | undefined;
      setAccessToken(token ?? null);
      return token ?? null;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

export async function backendFetch<T>(
  path: string,
  init?: RequestInit,
  options?: { retryOnUnauthorized?: boolean }
): Promise<T> {
  if (!isBackendEnabled()) {
    throw new Error('Backend mode is disabled. Set VITE_BACKEND_MODE=on or shadow.');
  }

  const headers = withDefaultHeaders(init?.headers);
  const token = getAccessToken();
  if (token) headers.set('authorization', `Bearer ${token}`);

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && options?.retryOnUnauthorized !== false) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      const retryHeaders = withDefaultHeaders(init?.headers);
      retryHeaders.set('authorization', `Bearer ${nextToken}`);
      const retry = await fetch(path, {
        ...init,
        headers: retryHeaders,
        credentials: 'include',
      });
      if (!retry.ok) {
        throw await toError(retry);
      }
      const payload = await retry.json();
      return (payload?.data ?? payload) as T;
    }
  }

  if (!response.ok) {
    throw await toError(response);
  }

  const payload = await response.json();
  return (payload?.data ?? payload) as T;
}

async function toError(response: Response): Promise<Error> {
  try {
    const payload = await response.json();
    const message = payload?.error ?? payload?.message ?? `Request failed (${response.status})`;
    return new Error(String(message));
  } catch {
    return new Error(`Request failed (${response.status})`);
  }
}
