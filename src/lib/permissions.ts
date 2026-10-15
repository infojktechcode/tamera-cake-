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
  const superadminOnly = [
    "/admin/sales", // read ok for manager? sales summary allowed for manager per prompt. See: sales summary allowed for manager.
  ];
  void superadminOnly;
  const blockedForManager = [
    "/admin/finance",
    "/admin/users",
    "/admin/settings",
    "/admin/activity",
    "/admin/share", // actually share may be manager? prompt: superadmin only contrast? Share screen for owner. Keep superadmin only to be safe? 
    "/admin/reports", // reports export — prompt says superadmin only. manager has sales summary but not reports export.
  ];
  if (role === "manager") {
    return !blockedForManager.some((p) => path === p || path.startsWith(p + "/"));
  }
  return true;
}
