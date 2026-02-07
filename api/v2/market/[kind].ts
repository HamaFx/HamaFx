import { fail, methodNotAllowed } from '../../_lib/http.js';

import * as cryptoHandler from '../../_v2/market/crypto.js';
import * as forexHandler from '../../_v2/market/forex.js';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
type Handler = (request: Request) => Promise<Response> | Response;
type HandlerModule = Partial<Record<HttpMethod, Handler>>;

const modules: Record<string, HandlerModule> = {
  crypto: cryptoHandler,
  forex: forexHandler,
};

function getKind(request: Request): string {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] ?? '');
}

async function dispatch(request: Request): Promise<Response> {
  const kind = getKind(request);
  const module = modules[kind];
  if (!module) return fail('Not found', 404);

  const method = request.method.toUpperCase() as HttpMethod;
  const handler = module[method];
  if (!handler) return methodNotAllowed(request.method);

  return handler(request);
}

export async function OPTIONS(request: Request) {
  return dispatch(request);
}

export async function GET(request: Request) {
  return dispatch(request);
}

export async function POST(request: Request) {
  return dispatch(request);
}

export async function PUT(request: Request) {
  return dispatch(request);
}

export async function PATCH(request: Request) {
  return dispatch(request);
}

export async function DELETE(request: Request) {
  return dispatch(request);
}
