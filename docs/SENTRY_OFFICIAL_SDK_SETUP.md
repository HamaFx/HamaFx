# Official Sentry SDK Setup (Vercel + Local)

This guide explains exactly how to switch from custom error transport to the official Sentry SDK and how to resolve `npm ERR! 403 Forbidden` for `@sentry/*` packages.

## Short answer: where to fix it

- **Vercel fixes runtime configuration only** (DSN/env/release values).
- **Code + package registry fixes SDK installation/integration**.

If `npm install @sentry/...` fails with `403`, this is **not** fixable in Vercel UI alone. You must fix npm registry access on your machine/CI first.

## 1) Fix the `403 Forbidden` install issue

Run these commands locally:

```bash
npm config get registry
npm ping --registry https://registry.npmjs.org
npm view @sentry/node version --registry https://registry.npmjs.org
```

If `npm view` returns `403`, check in this order:

1. `~/.npmrc` has a forced private registry or proxy.
2. `HTTP_PROXY` / `HTTPS_PROXY` env vars are set and blocking scoped packages.
3. Corporate gateway (Artifactory/Nexus/Verdaccio) blocks `@sentry/*` scope.

Quick temporary override for current shell:

```bash
npm config set registry https://registry.npmjs.org
npm config delete @sentry:registry
npm config delete proxy
npm config delete https-proxy
```

Then retry:

```bash
npm install @sentry/react @sentry/node @sentry/vite-plugin
```

If it still fails with `403`, the blocker is upstream policy (registry/proxy). In that case, allowlist:

- `@sentry/react`
- `@sentry/node`
- `@sentry/vite-plugin`

## 2) Configure Vercel env vars

In Vercel project settings -> Environment Variables, set:

- `VITE_SENTRY_DSN` (frontend DSN)
- `SENTRY_DSN` (server DSN)
- `VITE_SENTRY_ENVIRONMENT` and `SENTRY_ENVIRONMENT` (optional but recommended)
- `VITE_SENTRY_RELEASE` and `SENTRY_RELEASE` (optional, can be commit SHA)
- `SENTRY_AUTH_TOKEN` (required if uploading source maps with plugin)
- `SENTRY_ORG` and `SENTRY_PROJECT` (for source map upload)

## 3) Deploy and verify

1. Trigger one browser error.
2. Trigger one API error.
3. Confirm both appear in Sentry Issues.
4. Confirm stack traces are de-minified (source maps uploaded).

## 4) What is in code vs Vercel

- **Code repo**: SDK imports, `Sentry.init(...)`, error boundaries/hooks, Vite plugin.
- **Vercel**: runtime values and secret tokens.

You need both pieces for a complete official integration.
