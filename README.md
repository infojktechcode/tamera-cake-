# Tamera's Cakes & Bakery — order system

A mobile-first WhatsApp order system for **Tamera's Cakes & Bakery**, Kitengela,
Kenya. Customers browse on their phone, build a cake, add pastries to the same
order and send it on WhatsApp. The shop confirms, tracks and delivers it from a
dashboard that works on a phone too.

- **Public site** — home, cake gallery, pastries, cake builder, cart, checkout,
  order confirmation with a pre-filled WhatsApp message.
- **Admin dashboard** — orders board with live alerts, order detail with cake
  details and reference photos, payments, the status machine, staff accounts.
- **Supabase** — Postgres with Row Level Security on every table, Auth for staff,
  Storage for photos.

> **The WhatsApp button only opens a chat.** It fills the message in for you; the
> customer still presses send. Nothing is sent automatically and the WhatsApp
> Business API is not used (broadcasts are done by hand in WhatsApp Business).

---

## Requirements

- Node.js 20+ and [pnpm](https://pnpm.io) (`corepack enable pnpm` if needed)
- A Supabase project
- The project owner's Supabase credentials (project url, publishable key, secret key)

## Getting started

```bash
pnpm install
cp .env.example .env.local     # then fill it in — see below
pnpm dev                       # http://localhost:3000
```

### Environment variables

| Variable | Where it comes from | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Public. Safe in the browser. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys | Public (`sb_publishable_…`). The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` also works. |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys | **Server only.** Bypasses RLS — never prefix it with `NEXT_PUBLIC_` and never commit it. The legacy `SUPABASE_SERVICE_ROLE_KEY` also works. |
| `NEXT_PUBLIC_SITE_URL` | your deployment URL | Used for Open Graph images and the canonical links. |
| `NEXT_PUBLIC_SHOP_WHATSAPP` | the shop's WhatsApp number | The `wa.me` target, e.g. `254714965716`. |
| `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD` | yours | The owner account, created by `scripts/seed-users.mjs`. |
| `SEED_MANAGER_EMAIL` / `SEED_MANAGER_PASSWORD` | yours | The manager account. |

`.env.local` is git-ignored. Never put a real value in `.env.example`.

## The database

The schema lives in `supabase/migrations/` and runs in order:

| File | What it does |
|---|---|
| `0001_enums.sql` | the `user_role`, `order_status`, `fulfilment`, `pay_method`, `order_type` and `order_source` enums |
| `0002_tables.sql` | every table, with `updated_at` triggers |
| `0003_views_functions.sql` | `next_order_number()`, `cake_load_for_date()`, the reporting views |
| `0004_triggers.sql` | stock changes at confirmation, `amount_paid` follows the payments |
| `0005_rls.sql` | Row Level Security on every table, plus the `is_staff()` / `is_superadmin()` helpers |
| `0006_storage.sql` | the `cake-references` and `product-images` buckets |
| `0007_stock_trigger_fix.sql` | fixes a double stock restore on cancellation |
| `0008_indexes.sql` | indexes for the dashboard and the capacity check |

Apply them with the Supabase CLI (`supabase db push`) or by pasting them into
the dashboard's SQL editor.

### One-time repairs on the shop's live database

The shop's database was created by hand and is missing a few things. Paste
**`supabase/database-repairs.sql`** into the Supabase dashboard
(SQL editor → New query → Run) once. It is safe to run twice and it:

1. fixes the stock trigger (cancelling a confirmed order restored the stock twice),
2. adds the missing indexes,
3. adds `orders` to the Realtime publication so a new order reaches the dashboard
   instantly instead of waiting for the 20-second poll,
4. pins `search_path` on the two security-definer helper functions.

## Seeding

```bash
node scripts/seed-users.mjs        # creates the owner and manager accounts
node scripts/check-supabase.mjs     # connection, migrations and RLS check
node scripts/audit-supabase.mjs     # everything the app uses, checked against the live project
```

The demo catalogue (flavours, sizes, design tiers, pastries, delivery zones and
the shop settings) is in `supabase/seed.sql`. The prices there are placeholders
for the demo — replace them with Tamera's real prices in the Products screen
before launch.

## Admin screens (Phase 5)

| Screen | Path | What it does |
|---|---|---|
| Products | `/admin/products` | Tabs for pastries / cake flavours / cake sizes / design tiers. Inline price, availability, stock, photo. Owner sees cost and margin; owner deletes. |
| Customers | `/admin/customers` | Searchable list with orders count, lifetime spend, last order, repeat badge. Call / WhatsApp links. Detail page shows history. |
| Walk-in | `/admin/walk-in` | Fast counter sale: pick pastries, name + phone + consent, take cash/M-Pesa/bank. Saved as completed + paid; stock moves via the trigger. |
| Production calendar | `/admin/calendar` | Month / week / day views. Owner blocks/unblocks days; confirm step re-checks the calendar. |

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | development server |
| `pnpm build` / `pnpm start` | production build and server |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit and component tests |
| `pnpm test:e2e` | Playwright: the full customer journey (needs a seeded database) |

`pnpm test:e2e` places real orders in the database. Point it at a running
server with `E2E_BASE_URL=http://localhost:3000` (the default).

## Trying it on your phone

1. `pnpm dev` on the computer.
2. On the phone, open `http://<the computer's LAN address>:3000` (the dev server
   prints it, e.g. `http://192.168.0.154:3000`). The phone and the computer must
   be on the same Wi-Fi.
3. Build a cake, add a pastry, place the order — it lands on the confirmation
   page with a **Send order on WhatsApp** button.
4. The shop's dashboard is at `/admin` — sign in with the owner account.

## Deploying to Vercel

1. Push the code to a Git repository and import it in Vercel.
2. Add the environment variables from the table above (the same names).
3. Deploy. `pnpm build` is the build command; the app needs no extra
   configuration.
4. Run `supabase/database-repairs.sql` once against the production database.
5. Set `NEXT_PUBLIC_SITE_URL` to the deployment URL so WhatsApp previews show the
   right image.

## How the money and the security work

- **The browser never sends a price.** The order payload carries ids and
  quantities only; `POST /api/orders` re-reads the catalogue from the database
  and recomputes every amount. A tampered payload is rejected by the schema.
- **Customers never touch the database.** All customer writes go through route
  handlers that validate with Zod and insert with the service-role key.
- **Row Level Security is on everywhere.** A manager cannot read cost prices,
  expenses, other staff accounts or the activity log — in the UI *and* through
  the API.
- **Stock only moves when the shop confirms an order**, and a cancellation gives
  it back.
- **Cake dates respect the lead time, the blocked dates and the daily capacity**,
  both when the order is placed and when the shop confirms it.

## Project layout

```
src/
  app/
    (public)/        home, cakes, pastries, order/cake, cart, checkout, order/[number]
    admin/           the staff dashboard
      calendar/      production calendar, blocked dates
      customers/     list + customer detail
      walk-in/       counter-sale form
      products/      catalogue tabs (pastries, flavours, sizes, tiers)
    api/             route handlers (orders, upload, admin)
  components/
    public/          CakeBuilder, CartDrawer, CartView, CheckoutForm, Confetti
    admin/           OrdersBoard, OrderDetailPanel, StatusPill, ProductsTabs, CustomersTable, WalkInForm, ProductionCalendar
    motion/          reusable animation wrappers
  lib/
    pricing.ts       pure cake and cart price functions
    rules.ts         lead time, capacity and blocked-date checks
    order-status.ts  the order status machine
    product-edit.ts  pure catalogue-edit guards (margin, image path, dirty check)
    walk-in.ts       walk-in sale arithmetic
    customer-stats.ts pure customer summary math
    admin-calendar.ts calendar data helpers
    admin-date-check.ts confirm-time date rules
    format.ts        KES / Kenyan phone / Nairobi clock formatting
    product-image.ts image-path resolver
    whatsapp.ts      wa.me link builders
    supabase/        browser, server, service and public clients
supabase/
  migrations/        the schema
  seed.sql           the demo catalogue
  database-repairs.sql   one-time fixes for the live project
docs/DECISIONS.md    why things are the way they are
```
