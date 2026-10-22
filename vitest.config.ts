import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next.js knows the marker package; Vite does not.
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    // Only the unit and component tests — the Playwright suite in `e2e/`
    // runs under `pnpm test:e2e`, not under vitest.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    environment: "node",
    // Component tests need a DOM; store/lib tests stay DOM-free.
    // `environmentMatchGlobs` is deprecated in vitest 5 — use per-file
    // `// @vitest-environment jsdom` docblocks instead.
    setupFiles: ["./vitest.setup.ts"],
  },
});
