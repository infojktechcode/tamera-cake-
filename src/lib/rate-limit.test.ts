import { describe, it, expect, vi, beforeEach } from "vitest";

import { createRateLimiter } from "./rate-limit";

function makeHeaders(ip: string) {
  return new Headers({ "x-forwarded-for": ip });
}

async function check(limiter: ReturnType<typeof createRateLimiter>, headers: Headers) {
  const result = limiter.check(headers);
  return result instanceof Promise ? await result : result;
}

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows a burst of requests under the limit", async () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    for (let i = 0; i < 3; i++) {
      expect(await check(limiter, makeHeaders("1.1.1.1"))).toEqual({ ok: true });
    }
  });

  it("blocks the request that exceeds the limit", async () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    for (let i = 0; i < 3; i++) await check(limiter, makeHeaders("1.1.1.1"));
    const result = await check(limiter, makeHeaders("1.1.1.1"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each IP separately", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect((await check(limiter, makeHeaders("1.1.1.1"))).ok).toBe(true);
    expect((await check(limiter, makeHeaders("2.2.2.2"))).ok).toBe(true);
    expect((await check(limiter, makeHeaders("1.1.1.1"))).ok).toBe(false);
  });

  it("lets the window expire", async () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect((await check(limiter, makeHeaders("1.1.1.1"))).ok).toBe(true);
    expect((await check(limiter, makeHeaders("1.1.1.1"))).ok).toBe(false);
    vi.advanceTimersByTime(1001);
    expect((await check(limiter, makeHeaders("1.1.1.1"))).ok).toBe(true);
  });

  it("reads the client IP from x-forwarded-for", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    await check(limiter, makeHeaders("9.9.9.9"));
    const result = await check(limiter, makeHeaders("9.9.9.9"));
    expect(result.ok).toBe(false);
  });

  it("falls back to a shared bucket when the header is absent", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect((await check(limiter, new Headers())).ok).toBe(true);
    expect((await check(limiter, new Headers())).ok).toBe(false);
  });
});