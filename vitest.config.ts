import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Component tests need a DOM; store/lib tests stay DOM-free.
    // `environmentMatchGlobs` is deprecated in vitest 5 — use per-file
    // `// @vitest-environment jsdom` docblocks instead.
    setupFiles: ["./vitest.setup.ts"],
  },
});
