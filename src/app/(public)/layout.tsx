import Link from "next/link";
import type { ReactNode } from "react";
import { CartDrawer } from "@/components/public/CartDrawer";
import { getOrderSettings } from "@/lib/builder-data";
import { getShopWhatsapp, waHref } from "@/lib/whatsapp";

// Public shell constraint: static and cookie-free. No supabase imports, no
// cookies(), no settings fetch here — hours/address live on the home page.

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/cakes", label: "Cakes" },
  { href: "/pastries", label: "Pastries" },
] as const;

// Next 16 blocks `new Date()` during prerender; cache it once at build time
// instead of computing it inside the render.
async function getCopyrightYear(): Promise<number> {
  "use cache";
  return new Date().getFullYear();
}

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [year, settings] = await Promise.all([
    getCopyrightYear(),
    getOrderSettings(),
  ]);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-cocoa/10 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" aria-label="Tamera's Cakes & Bakery — home">
            {/* next/image refuses SVG by default; the logo is a vector mark. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/tameras-logo-horizontal.svg"
              alt="Tamera's Cakes & Bakery"
              className="h-8 w-auto"
            />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-4 text-sm font-medium">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-cocoa/80 transition-colors hover:text-strawberry"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-cocoa/10 bg-cream">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-8 sm:grid-cols-2">
          <div>
            <p className="font-display text-lg font-semibold">Tamera&apos;s Cakes &amp; Bakery</p>
            <p className="mt-1 text-sm text-ink-muted">
              Cakes and pastries made with love in Kitengela.
            </p>
            <a
              href={waHref(getShopWhatsapp(), "Hi Tamera! I have a question 🙂")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#25d366] px-5 py-2.5 text-sm font-semibold text-cocoa transition hover:opacity-90"
            >
              Chat on WhatsApp
            </a>
          </div>
          <nav aria-label="Footer" className="flex flex-col gap-2 text-sm sm:items-end">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-cocoa/80 transition-colors hover:text-strawberry"
              >
                {link.label}
              </Link>
            ))}
            <Link href="/login" className="mt-2 text-xs text-ink-muted underline">
              Staff login
            </Link>
          </nav>
        </div>
        <div className="border-t border-cocoa/10 py-4 text-center text-xs text-ink-muted">
          © {year} Tamera&apos;s Cakes &amp; Bakery
        </div>
      </footer>

      <CartDrawer depositThresholdKg={settings.deposit_threshold_kg} />
    </div>
  );
}
