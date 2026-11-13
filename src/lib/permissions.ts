import { NextResponse } from "next/server";

export type Role = "superadmin" | "manager";

export const capabilities = {
  superadmin: {
    viewCostPrice: true,
    viewProfit: true,
    viewExpenses: true,
    viewUsers: true,
    editPastSales: true,
    deleteProducts: true,
    editPrice: true,
    editSettings: true,
    viewActivityLog: true,
    exportReports: true,
    manageOrders: true,
    manageProducts: true,
    manageCustomers: true,
    managePayments: true,
    walkin: true,
  },
  manager: {
    viewCostPrice: false,
    viewProfit: false,
    viewExpenses: false,
    viewUsers: false,
    editPastSales: false,
    deleteProducts: false,
    editPrice: false,
    editSettings: false,
    viewActivityLog: false,
    exportReports: false,
    manageOrders: true,
    manageProducts: true, // descriptions, photos, availability, stock
    manageCustomers: true,
    managePayments: true,
    walkin: true,
  },
} as const;

export type Capability = keyof (typeof capabilities)["superadmin"];

export function can(role: Role, cap: Capability): boolean {
  return capabilities[role][cap];
}

export function isAdminPathAllowed(role: Role, path: string): boolean {
  const blockedForManager = [
    "/admin/finance",
    "/admin/users",
    "/admin/settings",
    "/admin/activity",
    "/admin/reports", // reports export — prompt says superadmin only. manager has sales summary but not reports export.
  ];
  if (role === "manager") {
    return !blockedForManager.some((p) => path === p || path.startsWith(p + "/"));
  }
  return true;
}

/**
 * Checks if a role has a specific capability.
 * Returns an error response if not allowed, or null if allowed.
 */
export function requireCapability(
  role: Role,
  capability: Capability
): NextResponse | null {
  if (!capabilities[role][capability]) {
    return NextResponse.json(
      { ok: false, error: "You don't have permission to perform this action." },
      { status: 403 }
    );
  }
  return null;
}
