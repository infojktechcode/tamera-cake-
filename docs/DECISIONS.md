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

## 8. Phase 3 (ordering)

- **The order route is the security boundary.** The browser sends ids and
  quantities only. `POST /api/orders` re-reads the catalogue and recomputes
  every price, deposit and delivery fee from the database; the Zod schema is a
  `strictObject`, so a tampered `unitPrice` or `total` is rejected rather than
  silently corrected. The split is deliberate: `src/lib/order-compute.ts` holds
  the pure arithmetic (18 tests, no database) and the route handler owns the
  I/O (15 tests against a stubbed client).
- **The capacity check does not use the `cake_load_for_date` SQL function.**
  PostgREST matches RPC arguments by the parameter name declared in SQL, and
  the live database's function is `cake_load_for_date(d date)`. Calling it with
  `{ date: … }` fails with PGRST202 — which made **every order fail with a
  500**. The route now counts the cakes with three indexed queries
  (`src/lib/cake-load.ts`), which cannot break that way; the SQL function stays
  in the schema for the production calendar and must be called with
  `{ d: … }` until the live database is repaired.
- **Reference photos are uploaded with a signed URL, not through the app
  server.** `POST /api/upload` validates the mime type and size and hands back a
  signed upload URL; the browser PUTs the bytes straight to Supabase storage.
  A 5 MB photo would otherwise hit the serverless request-size limit, and the
  bucket's own `file_size_limit` and `allowed_mime_types` still apply to the
  PUT, so the rules are enforced twice. The storage path is built from the
  *validated mime type* and a random id — a customer-supplied file name never
  reaches the path.
- **Photos are uploaded as they are picked, not at checkout.** The cart holds
  storage paths, so the photos survive a reload and can be attached to the
  order. The cost is an abandoned builder leaves an orphan file in the bucket;
  the shop deletes unused files by hand until a cleanup job exists.
- **The builder's date and fulfilment live in the cart, not in the cake item.**
  The date and the delivery method belong to the order, so they are order-level
  cart state (`CartState.details`). The checkout form starts from them instead
  of asking the customer to repeat the decision.
- **The cart has its own page.** The builder sends the customer to `/cart`; the
  page shows the whole order, lets the customer remove a line and links to
  checkout. It was missing at first, which dead-ended the journey on a 404.
- **A quoted design carries no deposit.** The server (`order-compute.ts`) takes
  no deposit for a tier with `requires_quote`, because there is no final price
  to take a percentage of. The client used to promise a deposit the server
  never asked for; the builder, the cart and the checkout now follow the server
  rule.
- **The rate limiter is per instance.** `src/lib/rate-limit.ts` keeps a
  fixed-window counter in memory: six orders and twelve uploads per minute per
  IP. It is not shared between instances and does not survive a restart — a
  deliberate trade-off for the current single-instance deploy, swappable for a
  shared store without changing the call sites.

## 9. Phase 4 (orders dashboard)

- **The status machine is pure and shared.** `src/lib/order-status.ts` holds
  the allowed moves and is enforced twice: the dashboard only offers the moves
  that are allowed, and `PATCH /api/admin/orders/[id]` refuses the rest. A
  manager may cancel an order that is not confirmed yet; once the shop has
  confirmed it, only the owner can cancel it. A pickup order skips the
  `out_for_delivery` leg.
- **The dashboard reads with the staff member's own session.** The admin
  screens use the cookie-aware Supabase client, so Row Level Security decides
  what a manager can see — the service-role key is only used to write the
  activity log, which staff may not insert into themselves.
- **Realtime is implemented, but the live database cannot deliver it yet.**
  No table in the shop's Supabase project is in the `supabase_realtime`
  publication, so no insert event is ever sent. The dashboard subscribes
  anyway (it works the moment the publication is fixed) and polls every 20
  seconds in the meantime, so a new order always shows up. Run
  `supabase/database-repairs.sql` to switch the alerts from polling to
  instant.
- **New orders are announced three ways**: the row slides in with a highlight,
  the sidebar badge counts up, and a short sound plays. The sound only plays
  after the shop presses "Enable alerts", because browsers block audio before a
  user gesture. The chime is built with the Web Audio API, so there is no
  sound file to download.
- **Staff sessions work with a cookie *or* a bearer token.** The dashboard uses
  the cookie; scripts and API clients send `Authorization: Bearer …`, and
  `getStaffSession()` returns both the identity and a client scoped to it, so
  RLS applies either way.

