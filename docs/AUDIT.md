# Follow-up audit — integrated completion branch

This section supersedes the historical baseline below wherever they differ.
It reflects the current `work/complete-phase-gaps` worktree and is not a
production sign-off.

## Verification on 2026-10-26

- Git is still in a merge (`MERGE_HEAD` exists), but `git ls-files -u` is
  empty. The merge has not been committed or continued. Staged, unstaged and
  untracked changes remain; review and explicit approval are still required
  before finalizing.
- The linked Supabase CLI reports local and remote migrations `0001`–`0009`
  aligned. Read-only schema checks found the atomic writer, idempotency fields,
  non-null unique public tokens, and no `orders` table in `supabase_realtime`.
  The writer is `SECURITY DEFINER`, executable by `service_role` only, and
  orders RLS is enabled with staff-only policies. No production write or
  publication change was made.
- A full `supabase db diff --linked --schema public` could not run because
  Docker/Podman is unavailable for the CLI shadow database. Migration history
  and the targeted remote schema/privilege checks passed, but this is not a
  complete catalog diff.
- Only the linked project is configured in `.env.local`; no separate staging
  project or staging credentials were found. Write-path Playwright tests were
  not run because the configured E2E flow creates real orders.
- Checkout now keeps a payload-bound idempotency key in tab-scoped session
  storage, so retries reuse the key but changed cart/details get a new one. The
  stored fingerprint is a SHA-256 digest rather than customer data; the API
  requires the key and SQL rejects reuse with a different request hash.
- The local `.env.example` was ignored and not present in Git history, but it
  contained populated seed-account values. Those values are now empty
  placeholders, and `.gitignore` allows this example file to be versioned.
  Rotate the corresponding Supabase Auth passwords if they were active.
- Current checks: `pnpm lint`, `pnpm typecheck`, `pnpm test` (35 files, 311
  tests), and `pnpm build` passed. One build attempt failed during Supabase
  data fetching; an isolated retry passed. ESLint excludes nested worktrees and the
  tracked task-generation artifact `phase3-complete.js`; no application source
  is excluded by that rule.
- The generic database repair script no longer alters Realtime publication.
  The dashboard polls every 20 seconds, so Realtime is an optional latency
  improvement and remains a separate owner-approved staging decision.

## Verified in this worktree

- Phase 3 ordering is integrated: cart, checkout, photo upload, server pricing,
  order confirmation and WhatsApp handoff are present. Order writes now use
  migration `0009_atomic_public_orders.sql` for one-transaction persistence,
  date-capacity serialization and retry idempotency.
- Public order confirmation URLs now use random UUID tokens instead of
  sequential order numbers, which previously made customer names, addresses
  and order details enumerable.
- Phase 4 order management and Phase 5 operations screens/routes are present.
- Phase 6 sales, finance, activity, reports and product sharing are present;
  reports are owner-only, and product sharing includes QR PNG/PDF output.
- Phase 7 has a manifest and icons, reduced-motion handling, robots and sitemap
  routes, and product-page canonical metadata.
- Historical local checks at the time of the integrated audit: TypeScript,
  ESLint, production build and 308 unit / component tests passed. See the dated
  verification section above for the latest results.

## Still required before release

1. Provision a separate disposable staging project and verify migrations and
   full order lifecycle there. The current linked project is not staging; no
   write tests were run against it.
2. Run the Playwright journey only against that disposable seeded database.
3. Perform a manual keyboard/screen-reader accessibility pass and run Lighthouse
   on a representative mobile device/network. The required WCAG, LCP and
   Lighthouse targets are not established by unit tests or a production build.
4. The IP rate limiter is in-memory and per application instance. It is
   effective only within that instance and resets on restarts; use a shared
   limiter before relying on it across horizontally scaled deployments.
5. Reconcile the seed catalogue and prices with the shop's current live data
   before launch.

## Historical baseline findings (pre-integration)

The following sections record the earlier audit snapshot. Their branch,
migration-count and test observations describe that earlier repository state,
not the current worktree.

Audited 2026-10-23 against `README.md`, `docs/DECISIONS.md`, `supabase/migrations/`,
`src/lib/{pricing,cart-store,order-compute,permissions,supabase/*}.ts`,
`src/app/**/*.ts(x)` and the e2e suite at `e2e/order-journey.spec.ts`.

## 1. Supabase connection — CONFIRMED, healthy

| Check | Result |
|---|---|
| Migration files | 7 (`0001_enums` … `0008_indexes`) — `README §5` accurate |
| RLS on every table | `0005_rls.sql`; `4` trigger files + storage `0006` |
| Public read policy | Anon key lists readable rows in every `public_read` policy |
| Service role bypass | `env.ts` strips `NEXT_PUBLIC_` and throws loudly when absent; only used by seed / admin handlers |
| Demo catalogue | `supabase/seed.sql` — categories, flavours, sizes, tiers, pastries, zones, settings, users |
| DB repairs SQL | `supabase/database-repairs.sql` documented as one-time for the shop's live DB |
| Remaining divergence risk | SEE §7 — `seed.sql` catalogue does not exactly match `Agent.md §8`; re-sync before Phase 5 |

## 2. GitHub connection — CONFIRMED

Remote: `https://github.com/infojktechcode/tamera-cake-.git` (single origin, push OK).
Current branch: `main`; last commit `372b4c9 feat(ordering): cart store + shared cart types`.
Layout matches README: `src/app/(public)`, `src/app/admin`, `src/app/api`, `src/components/{public,admin,ui}`, `src/lib`, `supabase/`.
README §5 says "Apply them with `supabase db push` or by pasting them into the dashboard's SQL editor" — that hint is now materially incomplete: there is **no local Postgres connection** (`no DB connection string`), so DB drift can only be corrected through Supabase's dashboard PostgREST. That is documented in DECISIONS §5, but worth flagging so future contributors don't rely on it.

## 3. Security — STRONG, with a small hardening gap

- Money integers everywhere (`pricing.ts`, `seed.sql`, `amount_paid` trigger parity via `0004`) — good.
- `proxy.ts` enforces `superadmin` paths for finance/users/settings/activity/share/reports; managers get redirected to `/admin` before rendering.
- `src/app/admin/layout.tsx` calls `requireUser()` again after the proxy layer — defense in depth.
- RLS on products (`product_costs`, `expenses`), activity log, staff accounts — manager cannot see cost prices server-side, matching the UI gate.
- Signed upload URL from `cake-references` bucket; client never sees `SUPABASE_SECRET_KEY`.
- `upload/route.ts` parses `File` data over form data → Zod schema (`name 1–80 chars`, mime enum, ≤5 MB) before issuing a signed URL.
- Rate limiting: 5 s per IP window.
- Headers in `next.config.ts`: CSP (imports + images + media, script-self, style unsafe-inline), `frame-ancestors 'none'`, X-CTO, Referrer-Policy, Permissions-Policy for geolocation/microphone/camera.
- Auth password change follows the active flag (`login/actions.ts`); inactive users are rejected at login.

### Gap found — upload rate limit is per-route instance, not global
The counter lives in module scope of `POST /api/upload` and is rebuilt per serverless execution. Under Vercel SPA mode, cold starts reset it — a distributed bot can defeat it. A single shared edge-state store would make it correct. See `docs/AUDIT.md §5`.

## 4. SEO optimization performance — GOOD, with two concrete gaps

What's working well:

- Share product page `/p/[slug]` runs `generateMetadata` at request time and passes absolute URLs to `buildShareMetadata()`, which resolves image URLs against `NEXT_PUBLIC_SITE_URL` so WhatsApp previews render correctly (`007af06`).
- Static prerendering for all `(public)` routes confirmed by `DECISIONS.md §7` ("every public route `●` static in the build").
- Home feed features `getFeaturedCakes(4)` loaded with `cacheTags` for effective cache invalidation when products update.
- No JS-runaway pages: public shell is statically rendered and cookie-free.
- OG metadata language consistent (`documentType`, `description`, `title` singular per page).

Gaps:

1. Indexing is zero to date because there are **no server-facing `robots.txt` and sitemap** under `app/[...]` or `public/`. Next generates an automatic sitemap at build time only if routes are static and have `<html>` metas; neither is guaranteed, and there is no explicit sitemap.xml shipped. For a crawlable shop this is incomplete today.
2. Pub page `/p/[slug]` uses slugs, but cake_flavours rows have no slug — the gallery uses direct UUID links (`/order/cake?flavour=<uuid>`), which works but means search engines cannot resolve `order/cake?uuid=...` URLs either (they require `?name=` as documented in DECISIONS §7, but links currently use uuid).
3. `manifest` metadata pinned to `/site.webmanifest` (`DECISIONS §7`) but no live web manifest ship or PWA build action exists yet — work is deferred to Phase 7, noted.
4. No canonical URLs set explicitly on share pages (`<link rel="canonical">`), only OG image absolutization — relative to missing canonical practice reduces duplicate-content handling.

## 5. Tests coverage — UNIT ONLY (JSVEA expected to break)

| File | Covers | Status |
|---|---|---|
| `src/lib/pricing.test.ts` | `cakePrice`, `lineTotal`, `cartSubtotal`, `depositRequired` | stable |
| `src/lib/cart-store.test.ts` | zustand add/remove/update/clear flows | stable |
| `src/lib/order-compute.test.ts` | `depositParity` cross-checking pricing + server rule | stable |
| `src/components/public/CakeBuilder.test.ts` | step wiring across a fake fetch chain | stable |
| `src/lib/validators/upload.schema.test.ts` | Zod schema strictness | stable |
| `src/lib/og.test.ts` | absolute-URL resolving logic | stable |
| `src/lib/whatsapp.test.ts` | `wa.me` builder invariants | stable |
| `src/lib/photo-compress.test.ts` | resize output bounds | stable |

- **No unit tests exist for:** `proxy.ts` (route guard logic), `permissions.ts`, `supabase/env.ts`, `order-compute.ts` API surface, any admin layout renderer, the checkout/order flow handlers.
- **No `vitest.config.ts` at project root** (`e2e/`, `vitest.config.{js,mjs}` `—` absent). Tests rely on next-eslint-friendly defaults, which will shift as TS config changes — this is fragile.
- **E2E:** `e2e/order-journey.spec.ts` drives the full 360× customer journey at the browser level, asserting photo upload path propagation into storage. Requires a seeded DB + running dev server (`E2E_BASE_URL=http://localhost:3000`). Not green in CI because `pnpm test:e2e` needs those; run it in a manually seeded env today.

## 6. Build verification

- `.next/build/` exists locally — a prior `pnpm build` completed, so production artifacts are present on disk. No build-failure warning surfaced in the recent diff.
- `cacheComponents: true` + `partialPrefetching: true` enabled per DECISIONS §4 — admin overview renders at request time (`instant = false` exports), public routes prerendered. `README §5` "produces all `/admin/*` routes as `ƒ` (dynamic)" matches observed behaviour.
- `turbopack.rules["*.css"].loaders = ["@tailwindcss/turbopack"]` — Tailwind v4 native loader; CSS compiles.

Note: production binaries were built previously; I could not regenerate them here without a Supabase connection and `SEED_*` env vars, both of which are intentionally absent from the repo tree. The earlier build passing is strong evidence, but the absence of a CI green-build in the current branch is unrecorded; confirm by running `pnpm build` once with a populated `.env.local`.

## 7. Recommended actions — priority order

1. **Fix the upload rate limit durability.** Move the 5-second per-IP limiter to a shared store (Supabase `Edge Functions` or Vercel KV-backed counter). One line of code; eliminates the biggest surface still exposed.
2. **Ship SEO stubs today** while Phase 5/7 work is still underway: a static `sitemap.xml` in `public/` listing `/`, `/cakes`, `/pastries`, `/order/cake`, `/cart`, `/checkout`, `/p/[slug]`, `/orders` (admin); and a thin `src/app/[sitemap]/page.tsx` page fallback generator. Resolve the UUID vs named-slug linking gap in DECISIONS §7.
3. **Add canonical tags** to `/p/[slug]` and `/order/cake` (with query redirect when name given).
4. **Add a vitest config + ignore postcss transform of node_modules**: isolated test runner config so CI stays green independent of ESLint defaults.
5. **Add unit tests for `permissions.ts`** (`can()`, `isAdminPathAllowed()` incl. the `sales` summary decision and `share` ambiguity flagged in comments) — currently untested and a likely source of off-by-one routing bugs.
6. **Build once more in CI** with the real `.env.local` filled and record `.next/build`-in-CI as green — closes the "built successfully" evidence gap.
7. **Re-sync `supabase/seed.sql`** with Tamera's live catalogue during Phase 5 product module work, as documented in DECISIONS §5.
