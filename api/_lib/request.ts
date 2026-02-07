import { corsHeaders, optionsResponse } from './http';
import { getEnv } from './env';

export function withCors(response: Response, request: Request): Response {
  let allowedOrigin = '*';
  try {
    allowedOrigin = getEnv().CORS_ALLOWED_ORIGIN;
  } catch {
    // Fall back when env is invalid; health endpoint should still return diagnostics.
  }
  const origin = request.headers.get('origin');
  const allowed = origin && origin === allowedOrigin ? origin : allowedOrigin;
  const headers = corsHeaders(allowed);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export function handleOptions(request: Request): Response {
  let allowedOrigin = '*';
  try {
    allowedOrigin = getEnv().CORS_ALLOWED_ORIGIN;
  } catch {
    // Fall back when env is invalid; health endpoint should still return diagnostics.
  }
  const origin = request.headers.get('origin');
  const allowed = origin && origin === allowedOrigin ? origin : allowedOrigin;
  return optionsResponse(allowed);
}

export function requestId(request: Request): string {
  return request.headers.get('x-request-id') || crypto.randomUUID();
}

export function hasProtectionBypass(request: Request): boolean {
  const env = getEnv();
  if (!env.PROTECTION_BYPASS_SECRET) return true;
  return request.headers.get('x-vercel-protection-bypass') === env.PROTECTION_BYPASS_SECRET;
}

export function parsePagination(request: Request, defaultLimit = 100, maxLimit = 500): { limit: number; offset: number } {
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get('limit') || defaultLimit);
  const rawOffset = Number(url.searchParams.get('offset') || 0);
  const limit = Math.max(1, Math.min(maxLimit, Number.isFinite(rawLimit) ? rawLimit : defaultLimit));
  const offset = Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0);
  return { limit, offset };
}
