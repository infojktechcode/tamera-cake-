# Product Backlog — Tamera WhatsApp Order System

> Single source of truth for planned, in-progress, and deferred work.  
> Each entry links to its audit finding or GitHub issue.

---

## Legend

| Status | Meaning |
|---|---|
| 🟢 **Done** | Merged to `main` / released |
| 🟡 **In Progress** | Active branch/PR |
| 🔵 **Ready** | Spec'd, awaiting capacity |
| 🟣 **Deferred** | Conscious decision to delay |
| ⚪ **Icebox** | Not prioritized, may never happen |

---

## Completed (This Audit Cycle)

| ID | Title | Audit Ref | Commit | Status |
|---|---|---|---|---|
| B-01 | Fix build: extract `findBestFlavourMatch` from `"use cache"` module | C1 | `570b68a` | 🟢 |
| B-02 | Fix settings save: normalise `FormData.get()` null→undefined, fix SMS coercions | C2 | `c63e215` | 🟢 |
| B-03 | Lint gate: ignore `.claude/skills/**` + `.agents/skills/**` | M1 | `72580d0` | 🟢 |
| B-04 | Fix cancelled template mapping: `product_update` → `order_cancelled` | M3 | `28dc245` | 🟢 |
| B-05 | Wrap fire-and-forget `notify()` in Next 16 `after()` | M5 | `a2be251` | 🟢 |
| B-06 | Rate-limiter Map eviction (periodic cleanup + 10k cap) | M6 | `c590566` | 🟢 |
| B-07 | Outbox retry processor + cron (`vercel.json` every 5 min) | M4 | `96e3509` | 🟢 |
| B-08 | SMS settings in admin UI + `message_templates` wired | H1, M2 | `cb123ca` | 🟢 |
| B-09 | Consolidate audit docs to single authoritative report | L1 | `e36f1e3` | 🟢 |
| B-10 | Apply Supabase migrations 0011–0014 to production DB | B2 | — (CLI) | 🟢 |

---

## Ready for Next Sprint

| ID | Title | Audit Ref | Description | Effort |
|---|---|---|---|---|
| B-11 | **Fix `CakeBuilder` integration test flake** | L3 | Intermittent timeout on drag-drop assertions under JSDOM. Add `await waitFor` / increase timeout or mock drag events deterministically. | S |
| B-12 | **E2E test isolation** | L4 | Playwright tests write real data to production Supabase. Need disposable staging project + seeded DB + CI pipeline. | M |
| B-13 | **Upload rate limiter: shared store** | docs/AUDIT.md §5 | Current in-memory limiter resets per serverless instance. Move to Vercel KV / Upstash Redis / Supabase Edge Function. | S |
| B-14 | **Canonical URLs + UUID↔slug linking** | docs/AUDIT.md §4 | `/p/[slug]` needs `<link rel="canonical">`; resolve UUID vs named-slug for share links. | S |
| B-15 | **Open Graph / Twitter cards on all public pages** | Phase 6 | Home, `/cakes`, `/p/[slug]`, `/pastries` — add `openGraph` + `twitter` metadata exports. | S |
| B-16 | **Cake gallery page** | Phase 6 | New `/gallery` route using showcase cakes from `products` table (`/showcase/*.jpg`). | M |
| B-17 | **DB-driven opening hours on home page** | Phase 6 | Replace hardcoded "Mon–Sun 8:00–8:00" with `settings.opening_hours` JSON. | S |
| B-18 | **Editable FAQ & policies** | Phase 6 | Admin UI for `settings.faq_items`, `delivery_policy`, `payment_policy`, `cancellation_policy`. | M |
| B-19 | **Brand colours + logo in settings** | Phase 7 | Admin colour picker + logo upload → `settings.brand_colours` / `logo_url`; apply via CSS vars. | M |
| B-20 | **Daraja credentials in SETUP.md** | Phase 7 | Document sandbox/production switch, shortcode, passkey, callback URL. | S |
| B-21 | **Unit tests for `permissions.ts`** | docs/AUDIT.md §5 | Test `can()`, `isAdminPathAllowed()` including `sales`/`share` edge cases. | S | `test(auth): cover permission boundaries` | 🟢 |
| B-22 | **Vitest config at project root** | docs/AUDIT.md §5 | Isolate test runner from ESLint defaults; stable CI. | S | `chore(test): stabilize root vitest configuration` | 🟢 |

---

## Deferred / Icebox

| ID | Title | Reason |
|---|---|---|
| I-01 | PWA / web manifest | Phase 7 — deferred until resellable polish |
| I-02 | WhatsApp Cloud API provider (alternative to Africa's Talking) | SMS works; WhatsApp is optional enhancement |
| I-03 | Multi-language (i18n) | Not in current scope |
| I-04 | Customer portal (order history) | Not in current scope |
| I-05 | Automated invoice PDF generation | Not in current scope |

---

## Conventions

- **Effort:** S = < 1 day, M = 1–3 days, L = 3–5 days, XL = > 5 days
- **Audit Ref** maps to `docs/AUDIT-2026-11-06.md` finding codes (C1, H1, M3, etc.) or the archived `docs/AUDIT.md` sections
- **Commit** = hash when merged; `— (CLI)` = applied via Supabase CLI
- Update this file when adding/completing items; keep it the single source of truth.