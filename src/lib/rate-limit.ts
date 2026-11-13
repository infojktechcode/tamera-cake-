/**
 * Rate limiter exports — unified interface for all rate limiters.
 *
 * All production limiters use distributed Upstash Redis.
 * Development uses local in-memory fallback when USE_LOCAL_RATE_LIMITER=true.
 *
 * Types and in-memory implementation are in `rate-limit-internal.ts`.
 * Upstash implementation is in `rate-limit-upstash.ts`.
 */

export {
  type RateLimitOptions,
  type RateLimitResult,
  type RateLimiter,
  clientIp,
  createRateLimiter,
} from "./rate-limit-internal";

import { createDistributedRateLimiter } from "./rate-limit-upstash";
export { createDistributedRateLimiter } from "./rate-limit-upstash";

/**
 * The limiter the order route uses — distributed via Upstash Redis.
 *
 * Six orders per minute per IP is generous for a person placing one order and
 * tight enough to stop a script from filling the order table.
 * FAIL OPEN on Redis outage — don't block legitimate orders.
 */
export const orderLimiter = createDistributedRateLimiter({ limit: 6, windowMs: 60_000, prefix: "rl:order", failOpen: true });

/** The limiter the upload route uses — distributed via Upstash Redis. */
export const uploadLimiter = createDistributedRateLimiter({ limit: 12, windowMs: 60_000, prefix: "rl:upload" });

/**
 * M-Pesa deposit retries — distributed via Upstash Redis.
 * Six per minute is plenty for a human who mistyped a number and stops a script
 * from spamming Daraja with STK Pushes (each of which pings a real phone).
 */
export const mpesaRetryLimiter = createDistributedRateLimiter({ limit: 6, windowMs: 60_000, prefix: "rl:mpesa_retry" });

/** Confirmation-page status polling — distributed via Upstash Redis. */
export const mpesaStatusLimiter = createDistributedRateLimiter({ limit: 60, windowMs: 60_000, prefix: "rl:mpesa_status" });

/**
 * The Daraja callback itself — distributed via Upstash Redis.
 * Generous — Safaricom retries callbacks — but capped so a flood cannot
 * fill the logs or the payments table.
 * FAIL OPEN on Redis outage — don't drop legitimate M-Pesa callbacks.
 */
export const mpesaCallbackLimiter = createDistributedRateLimiter({ limit: 120, windowMs: 60_000, prefix: "rl:mpesa_callback", failOpen: true });

/**
 * Login server action — 5 attempts per 15 minutes per IP.
 *
 * Prevents credential stuffing / brute force while allowing a legitimate user
 * a few retries. Uses distributed Upstash Redis so limits are shared across
 * all instances in production.
 * FAIL CLOSED on Redis outage — block login attempts if Redis is down.
 */
export const loginLimiter = createDistributedRateLimiter({ limit: 5, windowMs: 15 * 60_000, prefix: "rl:login", failOpen: false });

/**
 * Admin API read routes (GET) — 60 requests per minute per IP.
 *
 * Authenticated staff browsing the dashboard; generous enough for polling
 * and navigation but tight enough to catch automated scraping.
 */
export const adminReadLimiter = createDistributedRateLimiter({ limit: 60, windowMs: 60_000, prefix: "rl:admin_read" });

/**
 * Admin API write routes (POST, PATCH, DELETE) — 20 requests per minute per IP.
 *
 * Mutating actions (creating orders, recording payments, blocking dates, etc.);
 * stricter limit since these change state and are lower-volume by nature.
 */
export const adminWriteLimiter = createDistributedRateLimiter({ limit: 20, windowMs: 60_000, prefix: "rl:admin_write" });