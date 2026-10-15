# Decisions

Design and scope decisions made while building Tamera's Cakes & Bakery order
system. When something in `Agent.md` is ambiguous, the simplest sensible
choice was made and recorded here.

## 1. Architecture & tooling

- **Next.js 16 App Router, TypeScript, Tailwind v4.** `middleware.ts` is
  replaced by `proxy.ts` (Next 16 rename); all route guards live there plus a
  second check in `src/app/admin/layout.tsx`. **Placement matters:** the file
  must sit at `src/proxy.ts` — the same level as `src/app/` — or Next never
  executes it (a root-level `proxy.ts` is silently ignored).
- **All money is integer KES.** No floats anywhere — pricing, seed data and
  DB columns are all integers.
- **Supabase clients:** `src/lib/supabase/{server,middleware,browser,service,env}.ts`.
  `.env.local` uses the modern key names (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY`) with legacy anon-key fallbacks in `env.ts`.
  There is **no DB connection string**, so all live-DB fixes go through
  PostgREST (service key) rather than raw SQL.

## 2. Roles & access control

- Roles are exactly `superadmin` (owner) and `manager` — matching the
  `user_role` enum in `0001_enums.sql`. There is no cashier role.
- Capability matrix lives in `src/lib/permissions.ts`
  (`capabilities`, `can()`, `isAdminPathAllowed()`).
- Enforcement is layered, not button-hiding:
  1. RLS in Supabase (manager cannot read `product_costs`, `expenses`, `activity_log`),
  2. `proxy.ts` redirects managers away from superadmin paths (`/admin/finance`,
     `/admin/users`, `/admin/settings`, `/admin/activity`, `/admin/share`,
     `/admin/reports`) before the page renders,
  3. superadmin pages call `requireUser()` + `can()` server-side.
- `/admin/sales` stays visible to managers (sales summary is a manager
  capability); profit figures inside it are owner-only.

## 3. UI primitives

- The spec says "shadcn"; rather than pulling the full CLI, minimal
  shadcn-style primitives are hand-written in `src/components/ui/`
  (button, input, label, card, badge, skeleton) using the already-installed
  `cva` + `clsx` + `tailwind-merge`. Same API shape, full design-token control,
  no generator dependency. If more primitives are needed later, the shadcn CLI
  can add them without conflict.
- Buttons use pill radius + `active:scale-[0.97]` press feedback per the spec,
  done in CSS (no JS) so it works everywhere.

## 4. Auth

- Staff sign in with **email + password** (Supabase Auth), not phone + PIN —
  the technical plan specifies email/password and Supabase Auth handles
  reset flows for free.
- Inactive profiles are rejected at login (sign-out after check) and again by
  `requireUser()` on every admin render.
- Customers never authenticate; public site is anon-only.
- **Prerender fix:** Supabase's session handling calls `Date.now()`, which
  Next 16 (`cacheComponents`) rejects as an unstable value while prerendering.
  `requireUser()` now starts with `await connection()` (from `next/server`) so
  every admin route renders at request time — the single boundary all admin
  pages go through. The layout and the overview page additionally export
  `export const instant = false` to opt their segments out of instant-nav
  validation (the overview page calls `requireUser()` itself, so the layout's
  export alone doesn't cover it). Result: `pnpm build` shows all `/admin/*`
  routes as `ƒ` (dynamic) with zero prerender warnings.

## 5. Seed data

- **Live-DB repairs** for `cake_details` and `payments` were inserted via
  PostgREST with `SUPABASE_SECRET_KEY` because raw SQL access to the remote
  database isn't available (supabase CLI not linked, no connection string).
- Demo order numbers in the live DB are **TCB-0007…TCB-0010** (sequence had
  advanced past TCB-0001); `scripts/check-supabase.mjs` verifies seeded orders
  through the service key (anon is correctly blocked by RLS).
- **Known divergence:** `supabase/seed.sql` catalogue does not exactly match
  the sample list in `Agent.md` §8 (pastry assortment, `0.5kg` size, design
  tier names/fees, delivery zone names/fees). Prices in the spec are explicitly
  demo placeholders ("Tamera's real prices replace them before launch"), so the
  seed was left as-is rather than churning live demo orders mid-phase.
  **Action:** realign seed + live catalogue to Tamera's real price list during
  Phase 5 (products module), before launch.
- Fixed: leading-space slug bug (`' choc-chip-cookie'` → `'choc-chip-cookie'`)
  in seed and live row.
- `sync_amount_paid()` trigger (0004) keeps `orders.amount_paid` equal to
  `sum(payments)` — payment writes never set `amount_paid` directly.

## 6. Scope of Phase 1 (this increment)

- Login screen, admin shell (desktop sidebar / mobile bottom bar),
  role-filtered navigation, route guards, overview placeholder, and
  per-screen placeholders so nav never 404s.
- Order detail/confirmation, KPI queries and all other screens come in the
  later phases of `Agent.md`.

## 7. Phase 2 (public browsing)

- The cakes gallery shows **cake_flavours** rows (they have no slug), so a
  card links to `/order/cake?flavour=<uuid>` — products with slugs use
  `/p/<slug>` share pages instead.
- Pastries are **browse-only** until Phase 3: no steppers/cart on cards yet.
- The public shell is **static and cookie-free**: "Staff login" is a plain
  `<Link>` (no session client enters the `(public)` tree), which keeps every
  public route `●` static in the build.
- Category chips on `/pastries` are data-driven — with the current seed that
  renders `["All", "Pastries"]`, not a hardcoded list.
- Home featured cakes = products with `/showcase/*.jpg` images, fetched via
  `getFeaturedCakes(4)`.
- Env vars: `NEXT_PUBLIC_SITE_URL` (og:image absolutization) and
  `NEXT_PUBLIC_SHOP_WHATSAPP` (wa.me target) in `.env.local`.
- wa.me links only **open** a chat — the customer presses send (also note for
  the README when Phase 7 touches it).
- `manifest` metadata fixed to `/site.webmanifest`; the PWA work itself is
  Phase 7.
