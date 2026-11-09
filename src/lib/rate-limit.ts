/**
 * Rate limiter exports — unified interface for all rate limiters.
 *
 * The upload route uses a distributed Upstash Redis limiter for production.
 * Other routes (orders, M-Pesa) use the in-memory limiter as they are
 * lower-risk or have different scaling characteristics.
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

export { createDistributedRateLimiter } from "./rate-limit-upstash";

/**
 * The limiter the order route uses.
 *
 * Six orders per minute per IP is generous for a person placing one order and
 * tight enough to stop a script from filling the order table.
 */
import { createRateLimiter } from "./rate-limit-internal";
export const orderLimiter = createRateLimiter({ limit: 6, windowMs: 60_000 });

/** The limiter the upload route uses — distributed via Upstash Redis. */
import { createDistributedRateLimiter } from "./rate-limit-upstash";
export const uploadLimiter = createDistributedRateLimiter({ limit: 12, windowMs: 60_000 });

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