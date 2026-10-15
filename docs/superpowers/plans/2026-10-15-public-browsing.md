# Plan: Phase 2 — Public browsing (home, cakes, pastries, share page, shell, animations)

Spec: `Agent.md` line 251 — "Public browsing. Home, cakes gallery, pastries, product
share page, shared layout, animations. Done when a customer can browse smoothly on a phone."
Supporting spec sections: §6.1 (screens, lines 127–141), §7.4 (motion), §7.5 (UX), §9 (env).

Phase 1 is complete and verified (auth, admin shell, guards). This plan is self-contained:
an engineer with no prior context can execute it top to bottom.

## Global constraints (apply to every task)

1. **Verify per task:** `pnpm typecheck && pnpm lint && pnpm test` after each task.
   Run `pnpm build` at the end of Task 5 and Task 10 (build requires reachable Supabase).
   All four must be green before the final summary.
2. **Commit per task.** Repo currently has ZERO commits → Task 0 creates the Phase 1
   baseline first, so each Phase 2 task is one clean commit.
3. **Money is integer KES**, always rendered with `formatKES()` from `src/lib/format.ts`.
4. **Public pages must stay static.** No `cookies()`, no `@supabase/ssr` server client, no
   server actions anywhere under `src/app/(public)/`. Data comes only from the cookie-less
   anon client (`src/lib/supabase/public.ts`) through `"use cache"` fetchers.
5. **Every catalog fetcher:** `"use cache"` (file level) + `cacheTag("catalog")` +
   `cacheLife("hours")` at the top of each function body. On any query error → `throw`
   (never silently return an empty list — a broken DB must fail the build loudly).
6. **Next 16 rules:** `cacheComponents: true` is on → `export const dynamic` is FORBIDDEN.
   `generateStaticParams` must return ≥1 entry (empty array = build error). If unsure about
   an API, read `node_modules/next/dist/docs/`.
7. **Tailwind arbitrary hex values must be lowercase** (e.g. `from-[#e9dfd6]`).
8. Environment additions in Task 1 (`.env.example` already lists both):
   ```
   NEXT_PUBLIC_SITE_URL=http://localhost:3457
   NEXT_PUBLIC_SHOP_WHATSAPP=254700000000   # matches settings.whatsapp_number in seed
   ```
9. Copy is English, friendly WhatsApp tone, "Tamera's Cakes & Bakery" branding.
10. Gotchas already learned: `Spinner` is NOT exported from `src/components/motion`;
    `next/response` does not exist (use `next/server`); vitest has no config file and
    discovers `*.test.ts` by default; grep dev logs with `grep -a`.

---

## Task 0 — Baseline commit (Phase 1)

- `git add -A && git commit -m "phase 1: auth, admin shell, role guards, seed data"`
- Verify: `git log --oneline` shows exactly 1 commit; `git status` clean.

---

## Task 1 — WhatsApp helpers (TDD)

**Files:** `src/lib/whatsapp.ts` (new), `src/lib/whatsapp.test.ts` (new), `.env.local` (edit).

**RED** — write the test first (`src/lib/whatsapp.test.ts`):

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getShopWhatsapp, waHref } from "./whatsapp";

describe("waHref", () => {
  it("builds a wa.me link with encoded text", () => {
    expect(waHref("254700000000", "Two cakes 🎂 & candles")).toBe(
      "https://wa.me/254700000000?text=Two%20cakes%20%F0%9F%8E%82%20%26%20candles",
    );
  });
  it("normalises local formats first", () => {
    expect(waHref("0712345678", "hi")).toBe("https://wa.me/254712345678?text=hi");
  });
  it("throws on unusable numbers", () => {
    expect(() => waHref("banana", "hi")).toThrow();
  });
});

describe("getShopWhatsapp", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("reads and normalises NEXT_PUBLIC_SHOP_WHATSAPP", () => {
    vi.stubEnv("NEXT_PUBLIC_SHOP_WHATSAPP", "0700000000");
    expect(getShopWhatsapp()).toBe("254700000000");
  });
  it("throws when missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SHOP_WHATSAPP", "");
    expect(() => getShopWhatsapp()).toThrow(/NEXT_PUBLIC_SHOP_WHATSAPP/);
  });
  it("throws when invalid", () => {
    vi.stubEnv("NEXT_PUBLIC_SHOP_WHATSAPP", "not-a-number");
    expect(() => getShopWhatsapp()).toThrow();
  });
});
```

Run `pnpm test` → RED. **GREEN** — `src/lib/whatsapp.ts`:

```ts
import { normalizePhone } from "./phone";

/** https://wa.me/<digits>?text=<encoded message> — spec §9 link shape. */
export function waHref(number: string, message: string): string {
  const digits = normalizePhone(number);
  if (!digits) throw new Error(`waHref: unusable WhatsApp number "${number}"`);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Shop WhatsApp from env; throws loudly when missing/invalid (fail fast). */
export function getShopWhatsapp(): string {
  const raw = process.env.NEXT_PUBLIC_SHOP_WHATSAPP;
  if (!raw) throw new Error("Missing NEXT_PUBLIC_SHOP_WHATSAPP. Copy .env.example to .env.local.");
  const digits = normalizePhone(raw);
  if (!digits) throw new Error(`Invalid NEXT_PUBLIC_SHOP_WHATSAPP: "${raw}"`);
  return digits;
}
```

`normalizePhone` (src/lib/phone.ts) already handles `07…`, `7…`, `1…`, `2547…` shapes.

Also append both env lines to `.env.local` (constraint 8). Verify `pnpm test` green.
**Commit:** `feat(public): waHref + getShopWhatsapp helpers`

---

## Task 2 — `visualFor` emoji helper (TDD)

**Files:** `src/lib/visuals.ts`, `src/lib/visuals.test.ts`.

Deterministic keyword → emoji table. Pastry keywords MUST be checked before generic
cake/flavour keywords ("Chocolate Chip Cookie" is 🍪, not 🎂).

**RED** — `src/lib/visuals.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { visualFor } from "./visuals";

describe("visualFor", () => {
  it.each([
    ["Chocolate Chip Cookie", "🍪"],
    ["Glazed Donut", "🍩"],
    ["Mandazi pack (6)", "🍩"],
    ["Cinnamon roll", "🥐"],
    ["Banana loaf", "🍞"],
    ["Sweet bun", "🍞"],
    ["Cake pop", "🍭"],
    ["Cakesickle", "🍦"],
    ["Red Velvet", "🎂"],
    ["Chocolate fudge", "🎂"],
    ["something entirely new", "🧁"],
    ["", "🧁"],
  ])("%s → %s", (name, emoji) => {
    expect(visualFor(name)).toBe(emoji);
  });
});
```

**GREEN** — `src/lib/visuals.ts`:

```ts
const RULES: Array<[RegExp, string]> = [
  // pastries first — these names contain cake-ish words but are not cakes
  [/cookie/i, "🍪"],
  [/donut|doughnut/i, "🍩"],
  [/mandazi/i, "🍩"],
  [/cinnamon|roll/i, "🥐"],
  [/loaf|bun/i, "🍞"],
  [/cakesickle|sickle/i, "🍦"],
  [/pop/i, "🍭"],
  // cakes / flavours
  [/cake|velvet|chocolate|vanilla|strawberry|lemon|fudge|red/i, "🎂"],
];

/** Playful tile visual for a product/flavour name (seed pastries have no photos). */
export function visualFor(name: string): string {
  for (const [pattern, emoji] of RULES) if (pattern.test(name)) return emoji;
  return "🧁";
}
```

Careful: order in RULES is the contract — "Chocolate chip cookie" must hit `cookie`
before `chocolate`, so pastry rows stay on top. If a new test fails, fix the ORDER, not
the assertions. Verify `pnpm test` green. **Commit:** `feat(public): visualFor emoji helper`

---

## Task 3 — Public anon client + cached catalog fetchers

**Files:** `src/lib/supabase/public.ts` (new), `src/lib/catalog.ts` (new).

### 3a. Cookie-less anon client — `src/lib/supabase/public.ts`

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

let client: SupabaseClient | null = null;

/**
 * Anonymous, cookie-less Supabase client for public (prerendered) pages.
 * Never touches cookies, so pages using it stay static. Publishable key only.
 */
export function getPublicClient(): SupabaseClient {
  if (!client) {
    client = createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
```

Do NOT reuse `src/lib/supabase/browser.ts` (it has `"use client"` and uses `@supabase/ssr`
cookies) — importing it would break static prerender.

### 3b. Fetchers — `src/lib/catalog.ts`

File-level `"use cache"`; each function calls `cacheTag("catalog"); cacheLife("hours");`
as its first two statements; every function throws on `error`. Schema (from
`supabase/migrations/0002_tables.sql`): `products(id, category_id, name, slug, description,
image_url, price, available, sort_order)`, `categories(id, name, kind ∈ {'cake','pastry'},
sort_order, active)`, `cake_flavours(id, name, price_per_kg, image_url, available,
sort_order)`, `settings(id=1, shop_name, whatsapp_number, address, opening_hours jsonb)`.
RLS already grants anon select on all of these (0005 lines 28–35).

Exported types + functions:

```ts
export type PublicSettings = {
  shop_name: string;
  whatsapp_number: string;
  address: string | null;
  opening_hours: Record<string, { open: string; close: string }>; // keys mon..sun
};
export type ShowcaseCake = {
  slug: string; name: string; description: string | null;
  image_url: string; price: number;
};
export type FlavourCard = {
  id: string; name: string; price_per_kg: number; image_url: string | null;
};
export type PastryItem = {
  slug: string; name: string; description: string | null;
  image_url: string | null; price: number; category: string;
};
export type ShareProduct = {
  slug: string; name: string; description: string | null;
  image_url: string | null; price: number;
  category_name: string; category_kind: "cake" | "pastry";
};

getPublicSettings(): Promise<PublicSettings>
getFeaturedCakes(limit = 4): Promise<ShowcaseCake[]>
getFlavourCards(): Promise<FlavourCard[]>
getPastryCategories(): Promise<string[]>       // active pastry category names, sorted
getPastries(): Promise<PastryItem[]>           // available pastry products w/ category name, sorted
getProductSlugs(): Promise<string[]>           // available product slugs
getProductBySlug(slug: string): Promise<ShareProduct | null>
```

Query details:
- `getPublicSettings`: `select shop_name,whatsapp_number,address,opening_hours` from
  `settings`, `.single()`; throw on error; return data.
- `getFeaturedCakes`: from `products` select `slug,name,description,image_url,price`
  with inner join `categories!inner(kind,active)` filter
  `and(kind.eq.cake, active.eq.true, available.eq.true, image_url.like./showcase/*.jpg)`,
  `order=sort_order.asc`, `limit`. (The 8 showcase cakes are the only products with
  `/showcase/*.jpg` images.)
- `getFlavourCards`: `cake_flavours` where `available=true`, `order=sort_order.asc`.
- `getPastryCategories`: `categories` where `kind=eq.pastry, active=true`,
  `order=sort_order.asc`, map to `name`. (Seed yields `["Pastries"]`; chips prepend "All"
  in the component, not here.)
- `getPastries`: `products` select `slug,name,description,image_url,price,category:categories(name)`
  filter `and(available.eq.true, categories.kind.eq.pastry)`, `order=sort_order.asc`.
- `getProductSlugs`: `products` select `slug` where `available=true`.
- `getProductBySlug`: same join as getPastries, no category-kind filter,
  `.maybeSingle()` → `null` when not found (unknown slug is a 404, not an error).

**Verify:** typecheck/lint, then a one-off REST smoke check (no committed script):

```bash
source .env.local 2>/dev/null || true
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/products?select=slug,image_url&available=eq.true&limit=3" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
```

Expect JSON rows (proves anon RLS read path). Also confirm no `cookies`/`@supabase/ssr`
imports: `grep -rn "supabase/ssr\|cookies()" src/lib/catalog.ts src/lib/supabase/public.ts`
→ nothing. **Commit:** `feat(public): anon client + cached catalog fetchers`

---

## Task 4 — Motion rework + root layout polish

**Files:** `src/components/motion/index.tsx` (edit), `src/app/layout.tsx` (edit).

### 4a. `src/components/motion/index.tsx`

1. **Delete** the module-level `reduceMotion` constant and both `if (reduceMotion)` early
   returns in `FadeUp` / `ScaleIn`. Reduced motion is handled globally by MotionConfig
   (next step) — the module-level flag evaluated once at import and ignored user prefs.
2. **Keep `FadeUp`/`ScaleIn` prop API exactly as-is** (children, delay?, className?, ref)
   — Phase 1 admin code depends on it.
3. Add exports:

```tsx
export const Stagger = forwardRef<HTMLDivElement, { children: ReactNode; delay?: number; className?: string }>(...)
// variants parent: initial="hidden" animate="visible"
// hidden: {}, visible: { transition: { delayChildren: delay, staggerChildren: 0.08 } }

export const StaggerItem = forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(...)
// child variants: hidden { opacity: 0, y: 16 }, visible { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }

export const PageTransition = forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(...)
// initial { opacity: 0, y: 8 }, animate { opacity: 1, y: 0 }, transition { duration: 0.28, ease: [0.22, 1, 0.36, 1] }

export const Floating = forwardRef<HTMLDivElement, { children: ReactNode; className?: string; duration?: number }>(...)
// animate { y: [0, -10, 0] }, transition { duration: duration ?? 6, repeat: Infinity, ease: "easeInOut" }
```

All get `displayName`. `ease: [0.22, 1, 0.36, 1]` must be `as const`-cast if TS complains
about `Easing` tuple type.

### 4b. `src/app/layout.tsx`

1. Import `MotionConfig` from `motion/react`, wrap `{children}`:
   `<MotionConfig reducedMotion="user">{children}</MotionConfig>`.
   (T3 in spec §7.4: honor prefers-reduced-motion everywhere.)
2. Title template so share/page titles render nicely:
   ```ts
   title: { default: "Tamera's Cakes & Bakery", template: "%s | Tamera's Cakes" },
   ```
3. Micro-fix: `manifest: "/manifest.webmanifest"` → `"/site.webmanifest"`
   (the file is `public/site.webmanifest`; PWA manifest work itself is Phase 7).

**Verify:** `pnpm typecheck && pnpm lint && pnpm test` + `pnpm build`:
all `/admin/*` stay `ƒ`; `/` stays `●` static; zero warnings.
**Commit:** `feat(motion): MotionConfig reduced-motion + Stagger/PageTransition wrappers`

---

## Task 5 — `(public)` shell: layout, template, move home

**Files:** `src/app/(public)/layout.tsx` (new), `src/app/(public)/template.tsx` (new),
`src/app/(public)/page.tsx` (move from `src/app/page.tsx`), delete `src/app/page.tsx`.

### 5a. `layout.tsx` — static, cookie-free (constraint 4)

- Sticky top header: logo `<img src="/tameras-logo-horizontal.svg" alt="Tamera's Cakes & Bakery">`
  (plain `<img>` because next/image refuses SVG by default; add an eslint-disable comment
  for `@next/next/no-img-element` if lint flags it) linking to `/`, plus nav links:
  Home `/`, Cakes `/cakes`, Pastries `/pastries`.
- `<main>{children}</main>`.
- Footer: shop name, quick links (same three), **WhatsApp chat button** built with
  `waHref(getShopWhatsapp(), "Hi Tamera! I have a question 🙂")`,
  a **"Staff login" plain `<Link href="/login">`** (NOT a button component — avoids the
  session client in the static tree), copyright line.
- NO supabase imports, NO `cookies()`, NO settings fetch in the shell — the shell must
  prerender without network (hours/address live on the home page, per spec §6.1).

### 5b. `template.tsx`

```tsx
import type { ReactNode } from "react";
import { PageTransition } from "@/components/motion";
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
```

### 5c. Move home

`git mv src/app/page.tsx src/app/(public)/page.tsx` (or create + delete) keeping the
existing placeholder content — Task 6 rewrites it. Route URL `/` is unchanged (route
groups don't affect URLs).

**Verify:** typecheck/lint/test + `pnpm build`. Expect `/` `●` static, `/login` `●`,
`/admin/*` `ƒ`. **Commit:** `feat(public): static shell — header, footer, page template`

---

## Task 6 — Home page

**File:** `src/app/(public)/page.tsx` (rewrite) + small client component
`src/components/public/hero.tsx` if parallax needs hooks.

Sections, in order (spec §6.1 line 127):

1. **Hero** — headline "Cakes and pastries made with love in Kitengela." wrapped in
   `FadeUp`, decorative sprinkles (absolutely-positioned dots) in a `Floating` wrapper,
   light scroll parallax on a large decorative cake image (client component using
   `useScroll`/`useTransform`, translateY range ~40px — "kept light" per §7.4).
   Two large CTAs: **Order a cake** → `/cakes`, **Order pastries** → `/pastries`
   (builder itself is Phase 3, so the CTA lands on the gallery).
2. **Featured cakes** — `await getFeaturedCakes(4)`; 2-col grid on phones; each card is a
   `<Link href={`/p/${slug}`}>` with `next/image` (`fill`, `sizes="(max-width: 768px) 50vw, 25vw"`,
   `blurDataURL` from `src/lib/blur.ts`, wrapped in an `aspect-[4/3]` box to kill CLS),
   name + `formatKES(price)` + "starting".
3. **How it works** — plain `<ol>` (accessibility per §7.5) with three `<li>`s, each in a
   `FadeUp` with staggered `delay`:
   1. "Pick your cake or pastry" 2. "Send your order on WhatsApp" 3. "Confirm with a
   deposit — collect or get it delivered".
4. **Location** — address from `getPublicSettings()`, map link:
   `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`.
5. **WhatsApp CTA** — `waHref(getShopWhatsapp(), "Hi Tamera! I'd like to place an order.")`.

**New file `src/lib/blur.ts`** — one exported constant:

```ts
/** 1×1 PNG data URL used as low-quality placeholder for next/image blur. */
export const IMAGE_BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
```

Sanity-check it decodes (`node -e "..."` base64 → PNG signature `89 50 4E 47`) before
relying on it; if invalid, generate any 1×1 PNG and inline it.

All async data at top of the server component; client components only where hooks are
needed. **Verify:** typecheck/lint/test. **Commit:** `feat(public): home page`

---

## Task 7 — Cakes gallery `/cakes`

**Files:** `src/app/(public)/cakes/page.tsx`.

- `export const metadata = { title: "Cakes" }` (root layout applies the `%s` template).
- `const flavours = await getFlavourCards()` → mobile-first grid
  (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4`).
- Card: `flavour.image_url ? next/image : visualFor(flavour.name)` emoji tile on a soft
  gradient (seed flavours have no images → emoji tiles), flavour name, and
  **"From KES X/kg"** (`formatKES(price_per_kg)`).
- Whole card is `<Link href={`/order/cake?flavour=${flavour.id}`}>` — spec §6.1 line 128:
  tapping a flavour starts the cake builder with it preselected. Flavours have NO slug,
  so the uuid query param is the contract (builder consumes it in Phase 3; the route is a
  placeholder from Task 10).
- Add an `aria-label` on each link including the flavour name (tap targets ≥44px: use
  `p-3` + `min-h-[…]` on cards).

**Verify:** typecheck/lint/test. **Commit:** `feat(public): cakes gallery`

---

## Task 8 — Pastries `/pastries`

**Files:** `src/app/(public)/pastries/page.tsx`, `src/components/public/pastries-browser.tsx`.

- Server page: `const [pastries, categories] = await Promise.all([getPastries(), getPastryCategories()])`,
  metadata `{ title: "Pastries" }`, renders `<PastryBrowser pastries={pastries} categories={categories} />`.
- `pastries-browser.tsx` (`"use client"`): chips row = `["All", ...categories]` with
  `useState` selected chip; filtering is client-side over the passed array (no refetch —
  chips are data-driven; seed yields `["All", "Pastries"]`, layout must look right with 1–5
  chips, horizontally scrollable on narrow screens: `flex gap-2 overflow-x-auto`).
- Card: emoji tile via `visualFor(name)` (seed pastries have no photos) on alternating soft
  gradients, name, `formatKES(price)`, category caption.
- **Browse-only: NO steppers, NO add-to-cart** — cart is Phase 3 (recorded in DECISIONS.md,
  Task 10).

**Verify:** typecheck/lint/test. **Commit:** `feat(public): pastries browse page`

---

## Task 9 — Product share page `/p/[slug]` (TDD metadata helper)

**Files:** `src/lib/og.ts` + `src/lib/og.test.ts` (TDD), `src/app/(public)/p/[slug]/page.tsx`.

### 9a. RED — `src/lib/og.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { buildShareMetadata } from "./og";

const base = { name: "Banana loaf", description: "Moist banana loaf", price: 450,
               image_url: "/showcase/banana-loaf.jpg" };

describe("buildShareMetadata", () => {
  it("absolute og:image from siteUrl", () => {
    const m = buildShareMetadata(base, "http://localhost:3457");
    expect(m.openGraph?.images?.[0]?.url).toBe("http://localhost:3457/showcase/banana-loaf.jpg");
  });
  it("falls back when there is no image", () => {
    const m = buildShareMetadata({ ...base, image_url: null }, "http://localhost:3457");
    expect(m.openGraph?.images ?? []).toHaveLength(0);
  });
  it("uses product description", () => {
    const m = buildShareMetadata(base, "http://x");
    expect(m.description).toBe("Moist banana loaf");
    expect(m.openGraph?.description).toBe("Moist banana loaf");
  });
  it("falls back to shop blurb when description missing", () => {
    const m = buildShareMetadata({ ...base, description: null }, "http://x");
    expect(m.description).toBe("Order fresh from Tamera's Cakes & Bakery on WhatsApp.");
  });
  it("sets title and og type", () => {
    const m = buildShareMetadata(base, "http://x");
    expect(m.title).toBe("Banana loaf");
    expect(m.openGraph?.type).toBe("website");
  });
});
```

### 9b. GREEN — `src/lib/og.ts`

```ts
import type { Metadata } from "next";

export type ShareMetaProduct = {
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
};

export const SHARE_FALLBACK_DESCRIPTION =
  "Order fresh from Tamera's Cakes & Bakery on WhatsApp.";

export function buildShareMetadata(product: ShareMetaProduct, siteUrl: string): Metadata {
  const description = product.description?.trim() || SHARE_FALLBACK_DESCRIPTION;
  const images = product.image_url
    ? [new URL(product.image_url, siteUrl).toString()]  // absolute — WhatsApp requires it
    : [];
  return {
    title: product.name,
    description,
    openGraph: { type: "website", title: product.name, description, images },
  };
}
```

(`getSiteUrl()` from `src/lib/supabase/env.ts` supplies siteUrl at the call site; it is
explicitly passed here purely so the helper stays a pure function under test.)

### 9c. Page — `src/app/(public)/p/[slug]/page.tsx`

```ts
export async function generateStaticParams() {
  const slugs = await getProductSlugs();
  if (slugs.length === 0) {
    throw new Error("getProductSlugs() returned no slugs — refusing an empty sitemap.");
  }
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;                       // Next 16: params is a Promise
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  return buildShareMetadata(product, getSiteUrl());
}

export default async function SharePage({ params }: Props) { … }
```

Page body: `notFound()` for unknown slug; hero image (`fill` in `aspect-[4/3]`, `sizes`
`100vw`, blur) or emoji tile; category caption; `<h1>` name; description; price badge
`formatKES(price)` + " per kg" when `category_kind === "cake"` (else nothing); big WhatsApp
CTA: `waHref(getShopWhatsapp(), \`Hi Tamera! I'd like to order ${product.name} — ${formatKES(product.price)}.\`)`
plus a "Back to cakes/pastries" link. Spec §6.1 line 141: "proper Open Graph tags so links
look good in WhatsApp".

**Verify:** typecheck/lint/test + `pnpm build` → all `/p/…` pages `●` static; then
`curl -s localhost:3000/p/banana-loaf | grep -o 'property="og:image"'` in `pnpm start`
(optional) or grep the built output for `og:image`. A bogus slug must 404.
**Commit:** `feat(public): product share page with Open Graph tags`

---

## Task 10 — `/order/cake` placeholder + decisions + full verification

**Files:** `src/app/(public)/order/cake/page.tsx` (new), `docs/DECISIONS.md` (append).

### 10a. Placeholder route

`searchParams` is a Promise in Next 16: `const { flavour } = await searchParams;`.
If `flavour` is a known uuid (check against `getFlavourCards()`), show
"«name» selected — the cake builder arrives in Phase 3." else a generic
" Cake builder arrives in Phase 3." Add a back link to `/cakes`.
Route path `/order/cake` (static segment) was chosen so a later dynamic
`/order/[number]` order-status page never shadows it.

### 10b. `docs/DECISIONS.md` — append section "## 7. Phase 2"

Record: gallery shows **cake_flavours** (they have no slug → `/order/cake?flavour=<uuid>`);
pastries browse-only until Phase 3 (steppers/cart then); public shell is static/cookie-free
("Staff login" is a plain link so no session client enters the public tree); chips are
data-driven (seed → `["All", "Pastries"]`); home featured cakes = products with
`/showcase/*.jpg` images via `getFeaturedCakes(4)`; env vars
`NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_SHOP_WHATSAPP`; wa.me links only OPEN a chat — the
customer presses send (this note also goes in the README when Phase 7 touches it);
`manifest` path fixed to `/site.webmanifest` (PWA work = Phase 7).

### 10c. Full verification (all must pass)

1. `pnpm typecheck && pnpm lint && pnpm test` → green.
2. `pnpm build` → green, zero warnings; routes: `/`, `/cakes`, `/pastries`, `/p/<slug>`,
   `/login` all `●` static; `/admin/*` all `ƒ` dynamic.
3. Phone check (the "Done when" criterion): `pnpm dev`, open at **360px** wide:
   - Home: hero animation plays, featured cakes render with real photos, map link works.
   - `/cakes`: cards tap through to `/order/cake?flavour=…` placeholder.
   - `/pastries`: chips filter, emoji tiles, prices in KES.
   - Share page: WhatsApp CTA href matches `https://wa.me/254700000000?text=…` exactly.
   - Reduced motion: emulate `prefers-reduced-motion` → no animation.
   - `/admin` guard matrix still green (spot-check: signed-out → 307 `/login`).
4. `git status` clean; one commit per task (0–10 = 11 commits).

**Commit:** `feat(public): order/cake placeholder + phase 2 decisions`

---

## Review Focus (for plan review before execution)

- Constraint 4 (no cookies anywhere in `(public)`) is the load-bearing invariant — every
  public route must stay `●` static in the build output.
- Task 1 test encodes the EXACT wa.me URL shape from spec §9, emoji percent-encoding
  included — do not "simplify" the expected string.
- Task 2 RULES order (pastries before cake keywords) is the behaviour contract.
- Task 9 `generateStaticParams` throws on empty slug list (empty = build error by design).
- Task 6/7 image handling: `fill` + aspect box + `sizes` + shared blur → no CLS at 360px.
- Per-task commits; final state verified with all four commands + the 360px walkthrough.
