/**
 * Tests for the mock notification provider.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mockProvider, resetMock, setShouldFail, lastCall, callHistory } from "./mock";

beforeEach(() => {
  resetMock();
});

describe("mockProvider", () => {
  it("records calls and returns ok by default", async () => {
    const result = await mockProvider.send({ to: "254712345678", message: "Hello" });
    expect(result.ok).toBe(true);
    expect(lastCall).toEqual({ to: "254712345678", message: "Hello" });
    expect(callHistory).toHaveLength(1);
  });

  it("can simulate failure", async () => {
    setShouldFail(true);
    const result = await mockProvider.send({ to: "254712345678", message: "Hello" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Mock provider simulated failure");
  });

  it("resets state between tests", async () => {
    await mockProvider.send({ to: "254712345678", message: "First" });
    resetMock();
    expect(lastCall).toBeNull();
    expect(callHistory).toHaveLength(0);
  });
});