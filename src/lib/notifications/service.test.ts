/**
 * Tests for the notification service.
 *
 * Uses the mock provider — no real SMS is sent.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { notifyOrderStatusChange, queueNotification, sendNotification } from "./service";
import { mockProvider, resetMock, callHistory } from "./providers/mock";

vi.mock("@/lib/supabase/service", () => {
  const makeChain = () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: { id: "test-outbox-id" }, error: null }),
      insert: () => ({
        select: () => ({
          single: async () => ({ data: { id: "test-outbox-id" }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: "test-outbox-id" }, error: null }),
        }),
      }),
    };

    return chain;
  };

  return {
    createServiceClient: () => ({
      from: () => makeChain(),
    }),
  };
});

beforeEach(() => {
  resetMock();
  vi.clearAllMocks();
});

describe("queueNotification", () => {
  it("creates an outbox entry and returns the id", async () => {
    const result = await queueNotification({
      orderId: "test-order-1",
      channel: "sms",
      template: "deposit_request",
      toPhone: "254712345678",
      message: "Your deposit is due",
      idempotencyKey: "test-key-1",
    });
    expect(result.ok).toBe(true);
    expect(result.outboxId).toBe("test-outbox-id");
  });
});

describe("sendNotification", () => {
  it("returns error when sms is disabled (provider not called)", async () => {
    const result = await sendNotification({
      channel: "sms",
      toPhone: "254712345678",
      message: "Hello",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("disabled");
    expect(callHistory).toHaveLength(0);
  });
});

describe("notifyOrderStatusChange", () => {
  it("queues notification and returns result", async () => {
    const result = await notifyOrderStatusChange({
      orderId: "test-order-1",
      status: "pending_payment",
      channel: "sms",
      toPhone: "254712345678",
      template: "deposit_request",
      message: "Your deposit is due",
    });
    expect(result.ok).toBeDefined();
    expect(result.error).toContain("disabled");
  });
});