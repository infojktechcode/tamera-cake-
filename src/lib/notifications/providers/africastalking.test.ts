/**
 * Tests for the Africa's Talking provider.
 *
 * Uses mocked fetch — no real API calls are made.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { africastalkingProvider } from "./africastalking";

beforeEach(() => {
  vi.restoreAllMocks();
  // Ensure no credentials by default
  delete process.env.AFRICASTALKING_API_KEY;
  delete process.env.AFRICASTALKING_USERNAME;
});

describe("africastalkingProvider", () => {
  it("returns error when credentials are missing", async () => {
    const result = await africastalkingProvider.send({
      to: "254712345678",
      message: "Hello",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not configured");
  });

  it("sends SMS successfully with valid credentials", async () => {
    process.env.AFRICASTALKING_API_KEY = "test-key";
    process.env.AFRICASTALKING_USERNAME = "test-user";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        SMSMessageData: {
          Recipients: [
            { status: "Success", number: "254712345678" },
          ],
        },
      }),
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    const result = await africastalkingProvider.send({
      to: "254712345678",
      message: "Hello",
    });

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("https://api.africastalking.com/version1/messaging");
    expect(callArgs[1]?.headers?.ApiKey).toBe("test-key");
    const body = callArgs[1]?.body;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect((body as URLSearchParams).get("to")).toBe("254712345678");
    expect((body as URLSearchParams).get("message")).toBe("Hello");
  });

  it("returns error when API returns non-ok", async () => {
    process.env.AFRICASTALKING_API_KEY = "test-key";
    process.env.AFRICASTALKING_USERNAME = "test-user";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    const result = await africastalkingProvider.send({
      to: "254712345678",
      message: "Hello",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("401");
  });
});