import { fail, methodNotAllowed } from '../../_lib/http.js';

import * as loginHandler from '../../_v2/auth/login.js';
import * as logoutHandler from '../../_v2/auth/logout.js';
import * as meHandler from '../../_v2/auth/me.js';
import * as refreshHandler from '../../_v2/auth/refresh.js';
import * as registerHandler from '../../_v2/auth/register.js';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
type Handler = (request: Request) => Promise<Response> | Response;
type HandlerModule = Partial<Record<HttpMethod, Handler>>;

const modules: Record<string, HandlerModule> = {
  login: loginHandler,
  logout: logoutHandler,
  me: meHandler,
  refresh: refreshHandler,
  register: registerHandler,
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
