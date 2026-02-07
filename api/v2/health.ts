import * as healthHandler from '../_v2/health.js';

export async function OPTIONS(request: Request) {
  return healthHandler.OPTIONS(request);
}

export async function GET(request: Request) {
  return healthHandler.GET(request);
}
