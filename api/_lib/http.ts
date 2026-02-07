export type JsonBody = Record<string, unknown> | unknown[] | string | number | boolean | null;

export function json(body: JsonBody, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(headers ?? {}),
    },
  });
}

export function ok<T extends JsonBody>(data: T, headers?: Record<string, string>): Response {
  return json({ ok: true, data }, 200, headers);
}

export function fail(message: string, status = 400, details?: unknown): Response {
  return json({ ok: false, error: message, details }, status);
}

export function unauthorized(message = 'Unauthorized'): Response {
  return fail(message, 401);
}

export function forbidden(message = 'Forbidden'): Response {
  return fail(message, 403);
}

export function notFound(message = 'Not found'): Response {
  return fail(message, 404);
}

export function methodNotAllowed(method: string): Response {
  return fail(`Method ${method} not allowed`, 405);
}

export async function parseJson<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function corsHeaders(origin?: string | null): Record<string, string> {
  return {
    'access-control-allow-origin': origin || '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,x-request-id,x-vercel-protection-bypass',
    'access-control-allow-credentials': 'true',
  };
}

export function optionsResponse(origin?: string | null): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}
