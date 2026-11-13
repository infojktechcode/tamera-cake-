/**
 * Africa's Talking SMS provider.
 *
 * Sends SMS via Africa's Talking REST API.
 * Credentials are read from environment variables (server-only).
 * Never logs phone numbers or message content.
 */

import type { NotificationProvider, SendParams, SendResult } from "./types";

/** Africa's Talking API credentials (server-only). */
function getCredentials(): {
  apiKey: string;
  username: string;
} | null {
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const username = process.env.AFRICASTALKING_USERNAME;

  if (!apiKey || !username) {
    return null;
  }

  return { apiKey, username };
}

export const africastalkingProvider: NotificationProvider = {
  name: "africas_talking",

  async send(params: SendParams): Promise<SendResult> {
    const creds = getCredentials();
    if (!creds) {
      return {
        ok: false,
        error: "Africa's Talking credentials not configured (AFRICASTALKING_API_KEY, AFRICASTALKING_USERNAME)",
      };
    }

    try {
      const response = await fetch("https://api.africastalking.com/version1/messaging", {
        method: "POST",
        headers: {
          "ApiKey": creds.apiKey,
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: new URLSearchParams({
          username: creds.username,
          to: params.to,
          message: params.message,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        return {
          ok: false,
          error: `Africa's Talking API error (${response.status}): ${errorText}`,
        };
      }

      const result = await response.json();

      // Africa's Talking returns SMSMessageData with recipients array
      const recipients = result?.SMSMessageData?.Recipients ?? [];
      const failed = recipients.filter((r: { status: string }) => !r.status.startsWith("Success"));

      if (failed.length > 0) {
        return {
          ok: false,
          error: `Africa's Talking: ${failed.length} recipient(s) failed`,
        };
      }

      return { ok: true };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { ok: false, error: "Africa's Talking request timed out" };
      }
      return {
        ok: false,
        error: (error as Error).message,
      };
    }
  },
};