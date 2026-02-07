import * as cronHandler from '../../_v2/cron/maintenance.js';

export async function OPTIONS(request: Request) {
  return cronHandler.OPTIONS(request);
}

export async function GET(request: Request) {
  return cronHandler.GET(request);
}

export async function POST(request: Request) {
  return cronHandler.POST(request);
}
