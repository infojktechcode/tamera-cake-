import Link from "next/link";

import { logout } from "@/app/login/actions";
import { NewOrdersBadge } from "@/components/admin/new-orders-badge";
import { NewOrdersProvider } from "@/components/admin/new-orders-provider";
import { Button } from "@/components/ui/button";
import {
  can,
  isAdminPathAllowed,
  type Capability,
  type Role,
} from "@/lib/permissions";
import { requireUser } from "@/lib/session";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Hidden from roles where this capability is false. */
  capability?: Capability;
}

/**
 * Admin navigation. Order matters — it is the order shown in the sidebar and
 * the mobile bottom bar. Items without a capability are shown to everyone
 * (they are still path-guarded by isAdminPathAllowed below).
 */
const navItems: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "🏠" },
  { href: "/admin/orders", label: "Orders", icon: "🧾", capability: "manageOrders" },
  { href: "/admin/calendar", label: "Production", icon: "📅", capability: "manageOrders" },
  { href: "/admin/walk-in", label: "Walk-in", icon: "🚶", capability: "walkin" },
  { href: "/admin/products", label: "Products", icon: "🧁", capability: "manageProducts" },
  { href: "/admin/customers", label: "Customers", icon: "👥", capability: "manageCustomers" },
  { href: "/admin/sales", label: "Sales", icon: "📈" },
  { href: "/admin/finance", label: "Finance", icon: "💰", capability: "viewExpenses" },
  { href: "/admin/share", label: "Share", icon: "🔗", capability: "manageProducts" },
  { href: "/admin/reports", label: "Reports", icon: "📊", capability: "exportReports" },
  { href: "/admin/users", label: "Users", icon: "🪪", capability: "viewUsers" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️", capability: "editSettings" },
  { href: "/admin/activity", label: "Activity", icon: "🕘", capability: "viewActivityLog" },
];

function visibleNav(role: Role): NavItem[] {
  return navItems.filter(
    (item) =>
      (!item.capability || can(role, item.capability)) &&
      isAdminPathAllowed(role, item.href),
  );
}

// The whole admin shell reads the session cookie (requireUser). Under
// cacheComponents this is expressed as a non-instant route instead of the old
// `export const dynamic = "force-dynamic"` (which cacheComponents forbids):
// the page blocks on the request rather than being prerendered at build time.
export const instant = false;

/** Bottom bar on phones shows the most-used screens only. */
const mobileNav = [
  "/admin",
  "/admin/orders",
  "/admin/calendar",
  "/admin/products",
  "/admin/customers",
];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();

  // Route-level enforcement of role restrictions lives in proxy.ts (redirect
  // before render) and in each superadmin page (requireUser + can() check).
  const sidebarNav = visibleNav(user.role);
  const bottomNav = sidebarNav.filter((item) => mobileNav.includes(item.href));

  return (
    <NewOrdersProvider>
      <div className="min-h-dvh bg-cream text-cocoa">
        <div className="mx-auto flex max-w-7xl">
          {/* Desktop sidebar */}
          <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-cocoa/10 bg-white/70 px-3 py-5 lg:flex">
            <Link href="/admin" className="mb-6 flex items-center gap-2 px-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full bg-blush"
                aria-hidden
              >
                🎂
              </span>
              <span className="font-display text-base font-semibold leading-tight">
                Tamera&apos;s
                <span className="block text-xs font-normal text-ink-muted">
                  Cakes &amp; Bakery
                </span>
              </span>
            </Link>

            <nav className="flex flex-1 flex-col gap-1" aria-label="Admin">
              {sidebarNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium text-cocoa/80 transition-colors hover:bg-vanilla hover:text-cocoa"
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                  {item.href === "/admin/orders" && <NewOrdersBadge />}
                </Link>
              ))}
            </nav>

          <div className="mt-4 border-t border-cocoa/10 px-2 pt-4">
            <p className="truncate text-sm font-medium">{user.fullName}</p>
            <p className="text-xs capitalize text-ink-muted">{user.role}</p>
            <form action={logout} className="mt-2">
              <Button variant="outline" size="sm" type="submit" className="w-full">
                Sign out
              </Button>
            </form>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-cocoa/10 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
            <Link href="/admin" className="flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full bg-blush"
                aria-hidden
              >
                🎂
              </span>
              <span className="font-display text-sm font-semibold">Tamera&apos;s</span>
            </Link>
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </header>

          <main className="flex-1 px-4 py-5 pb-24 lg:px-8 lg:pb-8">{children}</main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Admin"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-cocoa/10 bg-white/95 backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-1.5">
          {bottomNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[11px] font-medium text-ink-muted transition-colors hover:bg-vanilla hover:text-cocoa"
            >
              <span className="text-lg leading-none" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      </div>
    </NewOrdersProvider>
  );
}
