import { defineConfig } from "@playwright/test";

/**
 * End-to-end configuration.
 *
 * The whole journey is written for a customer on a phone: a 360 px viewport
 * with touch, which is how the shop's customers actually use the site.
 *
 * The e2e test talks to the real database (it places a real order), so it is
 * run against a development server with the project's `.env.local`.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    hasTouch: true,
    locale: "en-KE",
    timezoneId: "Africa/Nairobi",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev --port 3000",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
