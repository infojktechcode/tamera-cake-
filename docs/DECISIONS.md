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

## 10. Phase 5 (products, customers, walk-in, calendar)

### 10.1 Products management

- **Four tables under one screen.** Products (pastries + showcase cakes), cake
  flavours, cake sizes and design tiers are edited in place. The tabs are
  Products / Flavours / Sizes / Tiers; the state lives in the client so a save
  updates the row without a full round trip, but the server remains the source of
  truth on the next visit.
- **Role-separated columns at the database level.** `product_costs` is only
  readable by the owner through RLS (`superadmin_costs_all`), so a manager
  *never receives a cost price* — there is nothing to hide in the browser. The
  same policy restricts price changes and product deletion to the owner
  (`staff_update_products` / `superadmin_delete_products`). The API re-checks
  every capability with `permissions.ts` for anyone calling it directly.
- **Photos upload via signed URLs, like the customer reference photos.** The
  staff-only route `POST /api/admin/product-image` signs a path in the
  `product-images` bucket; the browser PUTs the compressed bytes straight to
  storage. The returned path is what `PATCH /api/admin/products/[id]` stores in
  `image_url`. A helper (`isValidProductImagePath`) only accepts paths that the
  app itself can create (`/showcase/*.jpg` from the seed and
  `products/<random>.<ext>` from uploads) so a malicious input can never point
  the column at an arbitrary file or another bucket.
- **On-demand revalidation is instant.** Every mutation calls
  `revalidateTag("catalog", { expire: 0 })` so the public pastries page, the
  cake builder and the checkout all see the change on the next load. The
  `profile="max"` used for background mutations is too slow for a dashboard
  where the person making the edit wants to see it immediately.
- **A product on a past order cannot be deleted** (the foreign key from
  `order_items` blocks it); the API returns `409` with a clear message and the
  UI offers "switch it off" instead. This keeps the order history intact.

### 10.2 Customers

- **A customer is a phone number.** The order route upserts on it, so the same
  person always lands on one record whether they ordered online or walked in.
- **Statistics are pure.** `customer-stats.ts` has 10 tests; the client table
  and the server page share them, so the cancelled-order exclusion and the
  repeat badge are identical everywhere.
- **Call and WhatsApp links from the table.** `tel:` opens the dialer; the
  WhatsApp link pre-fills a friendly greeting that mentions the customer's first
  name.
- **Phone numbers display as `0720 009 999`** (`formatKenyanPhone`), so the
  shop reads them the way they speak them. The `href` still uses the `254…`
  format that WhatsApp expects.

### 10.3 Walk-in sales

- **A walk-in is a shop customer buying pastries over the counter** (spec §6.2).
  The form shows available pastries with a `+`/`-` stepper, a tiny stock hint,
  and a running total. The customer is a name + phone + a consent checkbox.
- **The server recomputes every price.** The browser sends ids and quantities;
  `POST /api/admin/walk-in` loads the catalogue again and computes the total
  itself, exactly like the online order route.
- **Going through `confirmed` keeps the stock rule in one place.** The sale is
  inserted as `new`, the payment is recorded, then the order moves to
  `confirmed` — the database trigger takes the pastries off the shelf — and
  finally to `completed`. Duplicating the stock logic in the route would be a
  second source of bugs.
- **A returning phone keeps its history and never loses a previous consent.**
  The upsert merges `consent = existing.consent || new.consent`, so an opt-in
  is permanent.
- **Activity is logged** (`walk_in_sale` with the order number and total) so the
  owner sees every counter sale in the activity feed.

### 10.4 Production calendar

- **A day is blocked or open.** `POST/DELETE /api/admin/blocked-dates` are
  owner-only and logged. The calendar page shows a month grid (compact on
  mobile), a week strip and a day panel; the day panel is where a blocked day
  is toggled.
- **The confirm step checks the calendar again.** A date can be blocked or
  filled up between the customer placing the order and the shop saying yes.
  `checkOrderDateRules` is called in `PATCH /api/admin/orders/[id]` when the
  status moves to `confirmed`, so a blocked day returns `400` at confirm time
  even if the order was placed when the day was open.

