/**
 * Mock notification provider.
 *
 * Records send calls without actually sending messages.
 * Used in tests and development when no provider credentials are configured.
 */

import type { NotificationProvider, SendParams, SendResult } from "./types";

/** Last call made to the mock provider (for test assertions). */
export let lastCall: SendParams | null = null;

/** All calls made to the mock provider (for test assertions). */
export const callHistory: SendParams[] = [];

/** Whether the mock should simulate failure. */
let shouldFail = false;

/** Set whether the mock should simulate failure (for tests). */
export function setShouldFail(value: boolean): void {
  shouldFail = value;
}

/** Reset all mock state. Call between tests. */
export function resetMock(): void {
  lastCall = null;
  callHistory.length = 0;
  shouldFail = false;
}

export const mockProvider: NotificationProvider = {
  name: "mock",

  async send(params: SendParams): Promise<SendResult> {
    lastCall = { ...params };
    callHistory.push({ ...params });

    if (shouldFail) {
      return { ok: false, error: "Mock provider simulated failure" };
    }

    return { ok: true };
  },
};