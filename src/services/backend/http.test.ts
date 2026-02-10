import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('backendFetch', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds protection bypass header when configured', async () => {
    vi.stubEnv('VITE_BACKEND_MODE', 'on');
    vi.stubEnv('VITE_PLAYWRIGHT_PROTECTION_BYPASS', 'bypass-token');

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { ok: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { backendFetch } = await import('./http');
    await backendFetch('/api/v2/health', { method: 'GET' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('x-vercel-protection-bypass')).toBe('bypass-token');
  });
});
