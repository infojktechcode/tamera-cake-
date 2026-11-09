/**
 * In-memory IP rate limiter for the public write routes.
 *
 * The spec (§10) requires the order and upload routes to be rate limited by
 * IP. This is a per-instance, fixed-window counter: correct for the current
 * single-instance deploy, and swappable for a shared store (Upstash, Postgres)
 * without changing the call sites.
 *
 * Not durable across restarts and not shared across instances — that is a
 * deliberate trade-off, not an oversight (see ledger ruling R4).
 */

export interface RateLimitOptions {
  /** Requests allowed per window, per IP. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the caller may retry. Only present when `ok` is false. */
  retryAfterSeconds?: number;
}

export interface RateLimiter {
  check(headers: Headers): RateLimitResult;
}

/** The client IP. `x-forwarded-for` is set by Vercel/most proxies; the first entry is the original client. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const { limit, windowMs } = options;
  // ip -> { count, resetAt }
  const buckets = new Map<string, { count: number; resetAt: number }>();

  // Prevent unbounded growth on long-running serverless instances.
  const MAX_BUCKETS = 10_000;
  const CLEANUP_INTERVAL = 5 * 60_000; // 5 minutes
  let lastCleanup = Date.now();

  function maybeCleanup(now: number) {
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;
    for (const [ip, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(ip);
    }
    // Hard cap: if still over limit, drop oldest 10% (by resetAt)
    if (buckets.size > MAX_BUCKETS) {
      const toDrop = Math.floor(buckets.size * 0.1);
      const sorted = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
      for (let i = 0; i < toDrop; i++) buckets.delete(sorted[i][0]);
    }
  }

  return {
    check(headers: Headers): RateLimitResult {
      const now = Date.now();
      maybeCleanup(now);
      const ip = clientIp(headers);
      const bucket = buckets.get(ip);

      if (!bucket || bucket.resetAt <= now) {
        buckets.set(ip, { count: 1, resetAt: now + windowMs });
        return { ok: true };
      }

      if (bucket.count >= limit) {
        return {
          ok: false,
          retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        };
      }

      bucket.count += 1;
      return { ok: true };
    },
  };
}

/**
 * The limiter the order route uses.
 *
 * Six orders per minute per IP is generous for a person placing one order and
 * tight enough to stop a script from filling the order table.
 */
export const orderLimiter = createRateLimiter({ limit: 6, windowMs: 60_000 });

/** The limiter the upload route uses. */
export const uploadLimiter = createRateLimiter({ limit: 12, windowMs: 60_000 });

/**
 * M-Pesa deposit retries. Six per minute is plenty for a human who mistyped a
 * number and stops a script from spamming Daraja with STK Pushes (each of
 * which pings a real phone).
 */
export const mpesaRetryLimiter = createRateLimiter({ limit: 6, windowMs: 60_000 });

/** Confirmation-page status polling. One poll every 4s is the client default. */
export const mpesaStatusLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

/**
 * The Daraja callback itself. Generous — Safaricom retries callbacks — but
 * capped so a flood cannot fill the logs or the payments table.
 */
export const mpesaCallbackLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });
