import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "./index.css";
import { App } from "./App";

const sentryDsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();
const sentryEnabled = Boolean(sentryDsn);

if (sentryEnabled) {
  const tracesSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "0");

  Sentry.init({
    dsn: sentryDsn,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined)?.trim() || import.meta.env.MODE,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
    integrations: [Sentry.browserTracingIntegration()],
  });
}

const root = createRoot(
  document.getElementById("root")!,
  sentryEnabled
    ? {
        onUncaughtError: Sentry.reactErrorHandler(),
        onCaughtError: Sentry.reactErrorHandler(),
        onRecoverableError: Sentry.reactErrorHandler(),
      }
    : undefined
);

root.render(
  <StrictMode>
    <App />
    <Analytics />
    <SpeedInsights />
  </StrictMode>
);
