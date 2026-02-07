import { fail, methodNotAllowed } from '../../_lib/http.js';

import * as alertsByIdHandler from '../../_v2/alerts/[id].js';
import * as alertsHandler from '../../_v2/alerts.js';
import * as auditHandler from '../../_v2/audit.js';
import * as chatHandler from '../../_v2/chat.js';
import * as marketCryptoHandler from '../../_v2/market/crypto.js';
import * as marketForexHandler from '../../_v2/market/forex.js';
import * as migrateImportHandler from '../../_v2/migrate/import.js';
import * as newsHandler from '../../_v2/news.js';
import * as settingsHandler from '../../_v2/settings.js';
import * as stateHandler from '../../_v2/state.js';
import * as watchlistsByIdHandler from '../../_v2/watchlists/[id].js';
import * as watchlistsHandler from '../../_v2/watchlists.js';

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
  const url = new URL(request.url);

  if (action === 'watchlists') {
    const id = url.searchParams.get('id');
    if (id) {
      return {
        module: watchlistsByIdHandler,
        rewrite: (req) => rewriteForId(req, '/api/v2/watchlists'),
      };
    }
    return { module: watchlistsHandler };
  }

  if (action === 'alerts') {
    const id = url.searchParams.get('id');
    if (id) {
      return {
        module: alertsByIdHandler,
        rewrite: (req) => rewriteForId(req, '/api/v2/alerts'),
      };
    }
    return { module: alertsHandler };
  }

  if (action === 'settings') {
    return { module: settingsHandler };
  }

  if (action === 'state') {
    return { module: stateHandler };
  }

  if (action === 'chat') {
    return { module: chatHandler };
  }

  if (action === 'audit') {
    return { module: auditHandler };
  }

  if (action === 'news') {
    return { module: newsHandler };
  }

  if (action === 'market') {
    const kind = url.searchParams.get('kind');
    if (kind === 'crypto') return { module: marketCryptoHandler };
    if (kind === 'forex') return { module: marketForexHandler };
    return null;
  }

  if (action === 'migrate-import') {
    return { module: migrateImportHandler };
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
