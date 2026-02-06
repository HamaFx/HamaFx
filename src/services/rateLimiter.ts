// Client-side rate limiter — tracks API call timestamps per provider
// Backend migration: replace with Redis sliding window

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const configs: Record<string, RateLimitConfig> = {
  coingecko: { maxRequests: 8, windowMs: 60_000 },    // 8/min (of 10-30 allowed)
  coincap: { maxRequests: 20, windowMs: 60_000 },     // 20/min (of 200 allowed)
  exchangerate: { maxRequests: 2, windowMs: 60_000 }, // 2/min (very conservative)
  frankfurter: { maxRequests: 10, windowMs: 60_000 }, // 10/min
  gemini: { maxRequests: 8, windowMs: 60_000 },       // 8/min (of 15 allowed)
  newsdata: { maxRequests: 3, windowMs: 60_000 },     // 3/min
};

const timestamps: Record<string, number[]> = {};

export const rateLimiter = {
  canMakeRequest(apiName: string): boolean {
    const config = configs[apiName];
    if (!config) return true;

    const now = Date.now();
    const calls = (timestamps[apiName] || []).filter(
      t => t > now - config.windowMs
    );
    timestamps[apiName] = calls;

    return calls.length < config.maxRequests;
  },

  recordRequest(apiName: string): void {
    if (!timestamps[apiName]) timestamps[apiName] = [];
    timestamps[apiName].push(Date.now());
  },

  getRemaining(apiName: string): { remaining: number; resetsIn: number } {
    const config = configs[apiName];
    if (!config) return { remaining: Infinity, resetsIn: 0 };

    const now = Date.now();
    const calls = (timestamps[apiName] || []).filter(
      t => t > now - config.windowMs
    );

    const remaining = Math.max(0, config.maxRequests - calls.length);
    const oldestCall = calls[0] || now;
    const resetsIn = Math.max(0, (oldestCall + config.windowMs) - now);

    return { remaining, resetsIn };
  },

  // Wait until a request can be made
  async waitForSlot(apiName: string): Promise<void> {
    if (this.canMakeRequest(apiName)) return;

    const { resetsIn } = this.getRemaining(apiName);
    await new Promise(resolve => setTimeout(resolve, resetsIn + 100));
  },
};
