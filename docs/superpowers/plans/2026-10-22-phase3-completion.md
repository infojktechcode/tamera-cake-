# Phase 3 completion plan — make the ordering flow actually work end to end

> Continuation of `docs/superpowers/plans/2026-10-15-ordering.md`. Tasks 7 and 8 of that
> plan were never done, and an audit of the Phase 3 work found four defects that break
> the customer journey. This plan closes Phase 3.

**Goal:** A customer on a 360 px phone can build a cake, add pastries, upload reference
photos, place a mixed order, and land on a confirmation page with a WhatsApp link — with
no dead ends, no lost input, and every price computed on the server.

**Baseline (verified before any change):** `vitest` 140/140 green, `tsc --noEmit` clean,
`eslint` clean, `next build` green, live Supabase project reachable (34/34 checks in
`scripts/check-supabase.mjs`).

## Defects found in the audit

| # | Defect | Evidence | Severity |
|---|---|---|---|
| D1 | `CakeBuilder` pushes `/cart` after "Add to cart", but **no `/cart` route exists** — the customer lands on a 404. | `CakeBuilder.tsx:308`; `next build` route table has no `/cart` | critical — journey dead-ends |
| D2 | Reference photos are collected as `File` objects and **never uploaded**. `CheckoutForm` hardcodes `referencePhotos: []`. | `CheckoutForm.tsx:116`; no `src/app/api/upload` | critical — feature missing |
| D3 | The builder collects a date and a delivery zone in step 6, then **discards both** when adding to the cart. The customer must re-enter them at checkout. | `CakeBuilder.tsx:286-309` (`addToCart` has no date/zone) | high — customer work is lost |
| D4 | `CartDrawer` calls `removeItem("cake-<uuid>")` but the store compares against `flavourId` — **a cake can never be removed from the cart**. | `CartDrawer.tsx:79-102` vs `cart-store.ts:108-118` | high |
| D5 | The client shows a deposit for a quote-only tier; the server (`computeOrder`) does **not** charge one. The customer is quoted a deposit that is never asked for. | `CheckoutForm.tsx:65-70` vs `order-compute.ts:194-199` | medium |
| D6 | `setPhotoError` is called inside a `setForm` updater — an impure updater that React may call twice. `URL.createObjectURL` runs during render and is never revoked. | `CakeBuilder.tsx:325-339`, `CakeBuilder.tsx:587` | medium |
| D7 | No security headers, though the spec (§10) requires CSP, `frame-ancestors none` and a referrer policy. | `next.config.ts` | medium |

## Tasks

### Task 7 — signed photo upload route
- `src/lib/validators/upload.schema.ts` — Zod schema (strict): name, mime type (jpg/png/webp), size (≤ 5 MB).
- `src/lib/photo-paths.ts` — pure helpers: build the storage path from the *validated* mime type (never the client filename), and build the public URL for a stored path.
- `src/app/api/upload/route.ts` — `POST` → rate limit by IP → validate → `createSignedUploadUrl` on `cake-references` → return `{ path, token }`.
- `src/lib/photo-compress.ts` — best-effort client-side resize (1600 px, JPEG 0.8) with a safe fallback to the original file.

### Task 8 — wire photos through the cart
- `src/types/cart.ts` — `CakeCartItem.referencePhotos` becomes `string[]` (storage paths).
- `src/lib/cart-store.ts` — photos are plain strings now, so they persist; drop the strip.
- `src/components/public/CakeBuilder.tsx` — step 4 compresses, requests a signed URL, uploads, and stores the path; upload errors surface inline.
- `src/components/public/CheckoutForm.tsx` — sends the real `referencePhotos` paths.

### Task 9 — the missing `/cart` page (D1)
- `src/app/(public)/cart/page.tsx` + `src/components/public/CartView.tsx` — items, remove, totals, "Checkout" CTA, empty state.

### Task 10 — cart correctness (D3, D4, D5, D6)
- Order-level cart details (`dateNeeded`, `timeNeeded`, fulfilment) so the builder's step 6 survives into checkout.
- `removeItem` id contract fixed.
- Deposit parity with `computeOrder` (quote-only tiers never show a deposit).
- Impure updater and object-URL leak fixed.

### Task 11 — security headers (D7)
- `next.config.ts` — CSP (Supabase + image hosts), `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

### Task 12 — e2e + docs
- `e2e/order-journey.spec.ts` — Playwright, 360 px, full mixed order.
- `docs/DECISIONS.md` — the Phase 3 section.
- `README.md` — setup, env vars, seeding, deployment, and the WhatsApp click-to-chat limitation (the spec asks for this at the end of Phase 3).

## Verification

- `pnpm test` (vitest) — unit + component tests, including the new upload route tests.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- `node scripts/check-supabase.mjs` — live DB + RLS still healthy.
- Playwright e2e against `next dev` with the live DB.
