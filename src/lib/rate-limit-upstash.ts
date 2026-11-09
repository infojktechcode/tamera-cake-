import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import type { RateLimitOptions, RateLimitResult, RateLimiter } from "./rate-limit";

/** Determines whether we're running in a production Vercel deployment. */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production" && !!process.env.VERCEL;
}

/** Determines whether we're in a build context (e.g., `next build`). */
function isBuild(): boolean {
  return process.env.NODE_ENV === "production" && !process.env.VERCEL;
}

/**
 * Local in-memory rate limiter for development and build-time.
 * Not shared across instances — only for local dev and build.
 */
function createLocalRateLimiter(options: RateLimitOptions): RateLimiter {
  const { limit, windowMs } = options;
  const buckets = new Map<string, { count: number; resetAt: number }>();
  const MAX_BUCKETS = 10_000;
  const CLEANUP_INTERVAL = 5 * 60_000;
  let lastCleanup = Date.now();

  function maybeCleanup(now: number) {
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;
    for (const [ip, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(ip);
    }
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
 * Creates a distributed rate limiter using Upstash Redis.
 *
 * Production (Vercel): uses Upstash Redis via REST API. Requires
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. If missing in
 * production, throws to fail securely — never silently falls back.
 *
 * Build (next build): uses local in-memory fallback so the build completes.
 *
 * Development: uses a local in-memory fallback when explicitly opted in via
 * USE_LOCAL_RATE_LIMITER=true.
 */
export function createDistributedRateLimiter(options: RateLimitOptions): RateLimiter {
  const { limit, windowMs } = options;

  // Production (Vercel): distributed Upstash Redis
  if (isProduction()) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production. " +
          "Configure them in Vercel project settings.",
      );
    }

    const redis = new Redis({ url, token });
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(limit, `${windowMs / 1000}s`),
      prefix: "rl:upload",
      // Disable analytics to reduce latency
      analytics: false,
    });

    return {
      async check(headers: Headers): Promise<RateLimitResult> {
        const ip = clientIp(headers);
        const { success, limit: max, remaining, reset } = await ratelimit.limit(ip);

        if (!success) {
          const retryAfter = Math.max(1, reset - Math.floor(Date.now() / 1000));
          return { ok: false, retryAfterSeconds: retryAfter };
        }

        return { ok: true };
      },
    };
  }

  // Build (next build): local fallback so the build can complete
  if (isBuild()) {
    return createLocalRateLimiter(options);
  }

  // Development: explicit local-only fallback
  if (process.env.USE_LOCAL_RATE_LIMITER === "true") {
    return createLocalRateLimiter(options);
  }

  // Default: fail securely if not in production and not explicitly opted into local
  throw new Error(
    "Rate limiter not configured. In production, set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. " +
      "In development, set USE_LOCAL_RATE_LIMITER=true to use the in-memory fallback.",
  );
}

/** The client IP. `x-forwarded-for` is set by Vercel/most proxies; the first entry is the original client. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  // x-real-ip is set by some proxies (nginx, Cloudflare)
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  // Fallback for local development where headers may be absent
  return "local-dev";
}