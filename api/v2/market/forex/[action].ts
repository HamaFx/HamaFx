import { fail, methodNotAllowed } from '../../../_lib/http.js';

import * as candlesHandler from '../../../_v2/market/forex/candles.js';
import * as pairsHandler from '../../../_v2/market/forex/pairs.js';
import * as quotesHandler from '../../../_v2/market/forex/quotes.js';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
type Handler = (request: Request) => Promise<Response> | Response;
type HandlerModule = Partial<Record<HttpMethod, Handler>>;

const modules: Record<string, HandlerModule> = {
  pairs: pairsHandler,
  quotes: quotesHandler,
  candles: candlesHandler,
};

function getAction(request: Request): string {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] ?? '');
}

async function dispatch(request: Request): Promise<Response> {
  const action = getAction(request);
  const module = modules[action];
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
