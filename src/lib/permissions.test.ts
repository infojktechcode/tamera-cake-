import { describe, it, expect } from "vitest";
import { can, isAdminPathAllowed, Role, Capability } from "./permissions";

describe("permissions", () => {
  const roles: Role[] = ["superadmin", "manager"];

  describe("can(role, capability)", () => {
    it("returns true for every capability when role is superadmin", () => {
      for (const cap of Object.keys(capabilities.superadmin) as Capability[]) {
        expect(can("superadmin", cap)).toBe(true);
      }
    });

    it("returns the defined boolean for each manager capability", () => {
      for (const cap of Object.keys(capabilities.manager) as Capability[]) {
        expect(can("manager", cap)).toBe(capabilities.manager[cap]);
      }
    });

    it("manager cannot view cost price, profit, expenses, or users", () => {
      expect(can("manager", "viewCostPrice")).toBe(false);
      expect(can("manager", "viewProfit")).toBe(false);
      expect(can("manager", "viewExpenses")).toBe(false);
      expect(can("manager", "viewUsers")).toBe(false);
    });

    it("manager cannot edit past sales, delete products, edit price, or edit settings", () => {
      expect(can("manager", "editPastSales")).toBe(false);
      expect(can("manager", "deleteProducts")).toBe(false);
      expect(can("manager", "editPrice")).toBe(false);
      expect(can("manager", "editSettings")).toBe(false);
    });

    it("manager cannot view activity log or export reports", () => {
      expect(can("manager", "viewActivityLog")).toBe(false);
      expect(can("manager", "exportReports")).toBe(false);
    });

    it("manager can manage orders, products, customers, payments, and walkin", () => {
      expect(can("manager", "manageOrders")).toBe(true);
      expect(can("manager", "manageProducts")).toBe(true);
      expect(can("manager", "manageCustomers")).toBe(true);
      expect(can("manager", "managePayments")).toBe(true);
      expect(can("manager", "walkin")).toBe(true);
    });

    it("superadmin can do everything", () => {
      expect(can("superadmin", "viewCostPrice")).toBe(true);
      expect(can("superadmin", "viewProfit")).toBe(true);
      expect(can("superadmin", "viewExpenses")).toBe(true);
      expect(can("superadmin", "viewUsers")).toBe(true);
      expect(can("superadmin", "editPastSales")).toBe(true);
      expect(can("superadmin", "deleteProducts")).toBe(true);
      expect(can("superadmin", "editPrice")).toBe(true);
      expect(can("superadmin", "editSettings")).toBe(true);
      expect(can("superadmin", "viewActivityLog")).toBe(true);
      expect(can("superadmin", "exportReports")).toBe(true);
      expect(can("superadmin", "manageOrders")).toBe(true);
      expect(can("superadmin", "manageProducts")).toBe(true);
      expect(can("superadmin", "manageCustomers")).toBe(true);
      expect(can("superadmin", "managePayments")).toBe(true);
      expect(can("superadmin", "walkin")).toBe(true);
    });
  });

  describe("isAdminPathAllowed(role, path)", () => {
    const blockedForManager = [
      "/admin/finance",
      "/admin/users",
      "/admin/settings",
      "/admin/activity",
      "/admin/reports",
    ];

    it("superadmin is allowed on all blocked paths", () => {
      for (const path of blockedForManager) {
        expect(isAdminPathAllowed("superadmin", path)).toBe(true);
        expect(isAdminPathAllowed("superadmin", path + "/detail")).toBe(true);
        expect(isAdminPathAllowed("superadmin", path + "/any/nested")).toBe(true);
      }
    });

    it("manager is blocked from exact blocked paths", () => {
      for (const path of blockedForManager) {
        expect(isAdminPathAllowed("manager", path)).toBe(false);
      }
    });

    it("manager is blocked from nested paths under blocked routes", () => {
      for (const path of blockedForManager) {
        expect(isAdminPathAllowed("manager", path + "/")).toBe(false);
        expect(isAdminPathAllowed("manager", path + "/detail")).toBe(false);
        expect(isAdminPathAllowed("manager", path + "/any/nested")).toBe(false);
      }
    });

    it("manager is allowed on non-blocked admin paths", () => {
      const allowed = [
        "/admin",
        "/admin/orders",
        "/admin/orders/123",
        "/admin/products",
        "/admin/calendar",
        "/admin/customers",
        "/admin/payments",
        "/admin/walkin",
        "/admin/share",
      ];
      for (const path of allowed) {
        expect(isAdminPathAllowed("manager", path)).toBe(true);
      }
    });

    it("manager is allowed on paths that share prefix but are not blocked", () => {
      // These are NOT under /admin/finance, /admin/users, etc.
      expect(isAdminPathAllowed("manager", "/admin/finance-report")).toBe(true);
      expect(isAdminPathAllowed("manager", "/admin/user-profile")).toBe(true);
      expect(isAdminPathAllowed("manager", "/admin/settings-page")).toBe(true);
    });

    it("exact path match vs prefix: /admin/reports blocks /admin/reports/export but not /admin/reporting", () => {
      expect(isAdminPathAllowed("manager", "/admin/reports")).toBe(false);
      expect(isAdminPathAllowed("manager", "/admin/reports/export")).toBe(false);
      expect(isAdminPathAllowed("manager", "/admin/reporting")).toBe(true);
    });
  });
});

// Re-export capabilities for test access
import { capabilities } from "./permissions";