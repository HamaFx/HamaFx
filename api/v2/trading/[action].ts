import { fail, methodNotAllowed } from '../../_lib/http.js';

import * as closePositionHandler from '../../_v2/positions/[id]/close.js';
import * as ordersByIdHandler from '../../_v2/orders/[id].js';
import * as ordersHandler from '../../_v2/orders.js';
import * as portfolioHandler from '../../_v2/portfolio.js';
import * as tradesHandler from '../../_v2/trades.js';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
type Handler = (request: Request) => Promise<Response> | Response;
type HandlerModule = Partial<Record<HttpMethod, Handler>>;

type RouteTarget = {
  module: HandlerModule;
  rewrite?: (request: Request) => Request;
};

function getAction(request: Request): string {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] ?? '');
}

function rewriteForId(request: Request, prefix: string): Request {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';
  const targetPath = `${prefix}/${encodeURIComponent(id)}`;
  const target = new URL(url.toString());
  target.pathname = targetPath;
  target.search = '';
  return new Request(target, request);
}

function resolveRoute(request: Request): RouteTarget | null {
  const action = getAction(request);

  if (action === 'portfolio') {
    return { module: portfolioHandler };
  }

  if (action === 'orders') {
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      return {
        module: ordersByIdHandler,
        rewrite: (req) => rewriteForId(req, '/api/v2/orders'),
      };
    }
    return { module: ordersHandler };
  }

  if (action === 'trades') {
    return { module: tradesHandler };
  }

  if (action === 'close-position') {
    return {
      module: closePositionHandler,
      rewrite: (req) => rewriteForId(req, '/api/v2/positions')
    };
  }

  return null;
}

async function dispatch(request: Request): Promise<Response> {
  const route = resolveRoute(request);
  if (!route) return fail('Not found', 404);

  const method = request.method.toUpperCase() as HttpMethod;
  const handler = route.module[method];
  if (!handler) return methodNotAllowed(request.method);

  const effectiveRequest = route.rewrite ? route.rewrite(request) : request;
  return handler(effectiveRequest);
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
