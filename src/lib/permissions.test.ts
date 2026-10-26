import { describe, expect, it } from "vitest";

import { can, isAdminPathAllowed } from "./permissions";

describe("admin path permissions", () => {
  it("allows managers to use product sharing but not export reports", () => {
    expect(can("manager", "manageProducts")).toBe(true);
    expect(isAdminPathAllowed("manager", "/admin/share")).toBe(true);
    expect(can("manager", "exportReports")).toBe(false);
    expect(isAdminPathAllowed("manager", "/admin/reports")).toBe(false);
  });

  it("keeps owner-only finance, user, settings and activity routes restricted", () => {
    for (const path of [
      "/admin/finance",
      "/admin/users",
      "/admin/settings",
      "/admin/activity",
    ]) {
      expect(isAdminPathAllowed("manager", path)).toBe(false);
    }
  });
});
