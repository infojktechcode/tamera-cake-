import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// @testing-library/react only auto-registers cleanup when vitest globals are
// enabled. We don't enable globals (the suite imports describe/it explicitly),
// so register it here — otherwise renders stack across tests and queries match
// elements from previous cases.
afterEach(() => {
  cleanup();
});
