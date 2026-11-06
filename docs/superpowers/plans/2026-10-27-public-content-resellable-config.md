# Public Content & Resellable Config Implementation Plan (v2 — revised after review)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 6 (Public Content & SEO) and Phase 7 (Resellable Configuration) fixes identified in AUDIT.md / REMEDIATION_PLAN.md: expose safe public settings with runtime validation, add OG/Twitter/canonical metadata, make the home page DB-driven, add a cake gallery, add policy pages, extend the admin SettingsForm, wire brand colours + logo from the DB, and expand SETUP.md.

**Architecture:** Sequential, foundational-first. Task 1 changes the shared `PublicSettings` contract; Tasks 2-10 build on it. Tasks 5 and 6 (gallery + policy pages) are new routes and depend on Task 1.

**Tech Stack:** Next.js 16.4.1 (App Router, `use cache`), React 19.3.0, TypeScript 5, Tailwind CSS v4, Supabase (PostgreSQL), Zod, pnpm 12.11.2

**Spec:** AUDIT.md, REMEDIATION_PLAN.md, `Tamera's Cakes & Bakery Technical Plan and Demo Data.md`, existing codebase

## Review Findings (why v2 differs from v1)

1. **Migrations already exist.** `supabase/migrations/0013_public_content.sql` and `0014_resellable_config.sql` are already in the tree and add every needed column. This plan does **not** create them — it only documents that they must be applied. No new migration is required.
2. **`sms_enabled` / `sms_provider` must NOT be public.** RLS policy `anon_read_settings` lets anonymous clients read **every** column of `settings`. Exposing the active SMS provider is needless information leakage. These two columns are excluded from `getPublicSettings()` and stay server-side (the notification service already reads them with the service client). Africa's Talking and Daraja credentials remain **only** in server env vars — never in a settings row.
3. **No runtime validation exists.** v1 only widened the TypeScript type. v2 adds a Zod schema with safe defaults so a malformed/missing `brand_colours`, `faq_items`, or `opening_hours` can never crash a public page.
4. **No cake gallery exists.** The audit lists a gallery as missing; showcase cakes already live in `products` with `/showcase/*.jpg` images. v2 adds `/gallery` with loading, empty, error, and mobile-responsive states.
5. **Logo lives in `(public)/layout.tsx`**, which already fetches settings via `getOrderSettings()` (a `use cache` public-client call). The "cookie-free" comment refers to auth, not the public client. v2 adds a dedicated cached `getBranding()` rather than overloading `getOrderSettings()`.
6. **No `catalog.test.ts` exists** and there are no page-level metadata tests — v2 creates them.
7. **Canonical + OG image URLs must be absolute** and resolved via `getSiteUrl()`; product pages already do this through `buildShareMetadata()`.

## Global Constraints

- Follow existing code patterns (async/await, Zod validation, Server Components, `"use cache"` + `cacheTag`/`cacheLife`).
- No new dependencies without approval (Zod is already a dependency).
- Server-only secrets (Daraja, Africa's Talking) never reach the client or a publicly readable row.
- All public data flows through `getPublicClient()` (RLS applies). Admin writes use the staff-scoped client.
- **No duplicate ordering paths, no UI redesign, no unrelated changes.**
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` must pass after each task.
- Do not claim tests passed unless they were actually run.

## Review Focus (failure modes that must have tests)

| Input / Condition | Expected Behavior |
|-------------------|-------------------|
| Missing `social_links` in settings | Public pages render; social icons hidden gracefully |
| Empty `faq_items` array | FAQ falls back to the existing hardcoded set or hides gracefully |
| Missing/empty `brand_colours` | Site uses existing Tailwind tokens (cocoa/strawberry/vanilla/pistachio) as fallback |
| Missing `logo_url` | Header falls back to static `/tameras-logo-horizontal.svg` |
| `opening_hours` malformed or missing | JSON-LD + UI fall back to the existing hardcoded hours; no 500 |
| `delivery_policy` / `payment_policy` / `cancellation_policy` null | Policy links hidden or show placeholder |
| No showcase products | `/gallery` renders an empty state, not a crash |
| SMS/Africa's Talking secrets | Never present in `getPublicSettings()` output |

---

### Task 1: Extend `getPublicSettings()` with safe public fields + Zod validation

**Files:**
- Modify: `src/lib/catalog.ts` (`PublicSettings` type + `getPublicSettings`)
- Create: `src/lib/settings-schema.ts` (Zod schema + safe defaults)
- Create: `src/lib/catalog.test.ts`

**Interfaces:**
- Consumes: `settings` table columns added by migrations 0013/0014 (`social_links`, `faq_items`, `delivery_policy`, `payment_policy`, `cancellation_policy`, `brand_colours`, `logo_url`).
- Produces: validated `PublicSettings` consumed by Tasks 2-6 and 8-10. **Excludes** `sms_enabled`/`sms_provider`.

- [ ] **Step 1: Create the Zod schema** in `src/lib/settings-schema.ts`

```ts
import { z } from "zod";

export const socialLinksSchema = z.object({
  whatsapp: z.string().url().optional(),
  facebook: z.string().url().optional(),
  instagram: z.string().url().optional(),
  tiktok: z.string().url().optional(),
}).partial().catch({});

export const faqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

export const brandColoursSchema = z.object({
  primary: z.string().optional(),
  secondary: z.string().optional(),
  accent: z.string().optional(),
  background: z.string().optional(),
}).partial().catch({});

export const openingHoursSchema = z.record(
  z.string(),
  z.object({ open: z.string(), close: z.string() })
).catch({});

export const publicSettingsSchema = z.object({
  shop_name: z.string(),
  whatsapp_number: z.string(),
  address: z.string().nullable(),
  opening_hours: openingHoursSchema,
  social_links: socialLinksSchema,
  faq_items: z.array(faqItemSchema).catch([]),
  delivery_policy: z.string().nullable(),
  payment_policy: z.string().nullable(),
  cancellation_policy: z.string().nullable(),
  brand_colours: brandColoursSchema,
  logo_url: z.string().nullable(),
});
```

- [ ] **Step 2: Write the failing tests** in `src/lib/catalog.test.ts`

Assert `getPublicSettings()` returns the new fields and that `sms_enabled`/`sms_provider` are **absent**. Assert malformed JSON in a row resolves to safe defaults rather than throwing. (Use the project's existing test DB/mocking convention — check `src/lib/*.test.ts` siblings first.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test src/lib/catalog.test.ts` → FAIL

- [ ] **Step 4: Widen the type, extend the select, validate**

In `src/lib/catalog.ts`: extend `PublicSettings`, add the new columns to `.select()`, and run the result through `publicSettingsSchema`. **Do not** select `sms_enabled`/`sms_provider`.

- [ ] **Step 5: Verify**

Run: `pnpm test && pnpm typecheck && pnpm lint` → PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/catalog.ts src/lib/settings-schema.ts src/lib/catalog.test.ts
git commit -m "feat: validate and expose safe public settings (Phase 6/7)"
```

---

### Task 2: Home page OG/Twitter/canonical metadata

**Files:**
- Modify: `src/app/(public)/page.tsx` (`metadata` export)
- Create: `src/app/(public)/page.test.ts` (metadata assertions only)

- [ ] **Step 1: Failing test** — assert `metadata.openGraph`, `metadata.twitter`, `metadata.alternates.canonical` are defined and `og` image URLs (if any) are absolute.
- [ ] **Step 2: Verify fail** — `pnpm test src/app/(public)/page.test.ts` → FAIL
- [ ] **Step 3: Implement** — make the page fetch `getSiteUrl()` and build full metadata (title, description, `openGraph`, `twitter`, `alternates.canonical`). Keep it consistent with `buildShareMetadata()` conventions.
- [ ] **Step 4: Verify pass** — `pnpm test && pnpm typecheck && pnpm lint` → PASS
- [ ] **Step 5: Commit** — `feat: add OG/Twitter/canonical metadata to home page`

---

### Task 3: Cakes page OG/Twitter/canonical metadata

**Files:**
- Modify: `src/app/(public)/cakes/page.tsx`
- Create: `src/app/(public)/cakes/page.test.ts`

Same four verification steps as Task 2, plus: if a featured cake image exists, use it as `og:image` resolved to an absolute URL. Commit: `feat: add OG/Twitter/canonical metadata to cakes page`.

---

### Task 4: Home page DB-driven opening hours, FAQ, social links, policies

**Files:**
- Modify: `src/app/(public)/page.tsx`
- Extend: `src/app/(public)/page.test.ts`

- [ ] **Step 1: Failing tests** — opening hours (JSON-LD + visible UI) come from `settings.opening_hours`; FAQ renders `settings.faq_items`; social links render when present; policy links render when the policy text is present.
- [ ] **Step 2: Verify fail** → FAIL
- [ ] **Step 3: Implement with fallbacks:**
  - JSON-LD `openingHoursSpecification` built from `settings.opening_hours`; fall back to `"Mo-Su 08:00-20:00"` when empty.
  - Visible hours string built from the same data; fall back to `"Mon–Sun: 8:00am–8:00pm"`.
  - FAQ section maps `settings.faq_items`; when empty, keep the current hardcoded FAQ so nothing regresses.
  - Social links rendered from `settings.social_links` (hidden when empty).
  - Policy links render only when the corresponding policy text is non-empty, pointing at the Task 6 routes.
- [ ] **Step 4: Verify pass** → PASS
- [ ] **Step 5: Commit** — `feat: drive home page hours/FAQ/social/policies from settings`

---

### Task 5: Cake gallery page (`/gallery`)

**Files:**
- Create: `src/app/(public)/gallery/page.tsx`
- Create: `src/app/(public)/gallery/page.test.ts`
- Optional helper: extend `src/lib/catalog.ts` with a `getGalleryItems()` that selects showcase products (slug, name, description, price, `image_url`) from `products` (reuse `getFeaturedCakes`/`getProductBySlug` patterns — do **not** invent a new table).

- [ ] **Step 1: Failing tests** — metadata present; renders product cards from the products table; empty state when no showcase products; mobile-responsive grid classes.
- [ ] **Step 2: Verify fail** → FAIL
- [ ] **Step 3: Implement** the route: `"use cache"` data fetch via `getPublicClient()`, responsive `grid`, `next/image` with `IMAGE_BLUR_DATA_URL`, loading skeleton, empty-state message, and an error boundary/fallback. Link each card to `/p/[slug]` (existing product page — **no duplicate ordering path**). Add a nav entry only if it doesn't disturb the existing header.
- [ ] **Step 4: Verify pass** → `pnpm test && pnpm typecheck && pnpm lint && pnpm build` → PASS
- [ ] **Step 5: Commit** — `feat: add public cake gallery page`

---

### Task 6: Policy pages (delivery / payment / cancellation)

**Files:**
- Create: `src/app/(public)/policies/[type]/page.tsx` (or three small static routes — follow the existing route conventions; a single dynamic route with `generateStaticParams` for the three types is preferred).
- Create: matching test file.

- [ ] **Step 1: Failing tests** — each policy type renders its settings text; unknown type → `notFound()`; missing policy text → friendly empty state; metadata present.
- [ ] **Step 2: Verify fail** → FAIL
- [ ] **Step 3: Implement** reading `delivery_policy`/`payment_policy`/`cancellation_policy` from `getPublicSettings()`. `generateStaticParams` for the three types. Keep the layout consistent with other public pages.
- [ ] **Step 4: Verify pass** → PASS
- [ ] **Step 5: Commit** — `feat: add public policy pages backed by settings`

---

### Task 7: Extend admin `SettingsForm` with the new fields

**Files:**
- Modify: `src/components/admin/SettingsForm.tsx`
- Modify: `src/app/admin/settings/page.tsx`
- Create: `src/components/admin/SettingsForm.test.tsx`

**Note:** `updateSettings` (server action) already accepts all these fields — only the UI is missing. Do not change the action's schema unless a field is genuinely rejected.

- [ ] **Step 1: Failing tests** — form renders the new fields; JSON fields accept text and submit parsed values; submitting calls `updateSettings` with all fields.
- [ ] **Step 2: Verify fail** → FAIL
- [ ] **Step 3: Implement** new inputs: `social_links` (textarea, JSON, helper text showing `{whatsapp,facebook,instagram,tiktok}`), `faq_items` (textarea, JSON, `[{question,answer}]` helper), `delivery_policy`/`payment_policy`/`cancellation_policy` (textareas), `brand_colours` (textarea, JSON, `{primary,secondary,accent,background}` helper), `logo_url` (text input with "upload to Supabase Storage then paste the path" hint). **Do not add `sms_enabled`/`sms_provider` toggles here unless the server action already persists them and product wants it** — confirm before adding.
- [ ] **Step 4: Verify pass** → PASS
- [ ] **Step 5: Commit** — `feat: extend admin settings form with content + branding fields`

---

### Task 8: Brand colours as CSS custom properties

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/(public)/layout.tsx` (inject a `<style>` block from `getBranding()`)
- Create: `src/app/branding.test.ts` (or colocated)

- [ ] **Step 1: Failing tests** — CSS variables reflect `settings.brand_colours` when present; fall back to the current token values when missing/empty.
- [ ] **Step 2: Verify fail** → FAIL
- [ ] **Step 3: Implement:**
  - `globals.css`: define `:root` custom properties (`--color-primary`, `--color-secondary`, `--color-accent`, `--color-background`) defaulting to the current cocoa/strawberry/pistachio/vanilla values, and point the existing Tailwind `@theme` tokens at them so nothing visually changes by default.
  - `getBranding()` in `catalog.ts` (cached, public client) returns `{ brand_colours, logo_url }`.
  - In `(public)/layout.tsx`, render a `<style>` element setting those variables from `brand_colours` when non-empty. Server-rendered — no client JS.
- [ ] **Step 4: Verify pass** → `pnpm test && pnpm typecheck && pnpm lint && pnpm build` → PASS
- [ ] **Step 5: Commit** — `feat: apply brand colours from settings via CSS custom properties`

---

### Task 9: Logo from `settings.logo_url` + footer social links

**Files:**
- Modify: `src/app/(public)/layout.tsx` (header logo + footer)
- Extend: branding test

- [ ] **Step 1: Failing tests** — header uses `logo_url` when set; falls back to `/tameras-logo-horizontal.svg` when not; footer renders social links from `settings.social_links` and hides them when empty.
- [ ] **Step 2: Verify fail** → FAIL
- [ ] **Step 3: Implement** — in the layout, when `logo_url` is present render `<Image src={logoUrl} …/>` (resolve to a public Storage URL); otherwise keep the existing static SVG. Add social icons/links to the footer from `settings.social_links`, hidden when empty. Preserve the existing WhatsApp link and nav.
- [ ] **Step 4: Verify pass** → PASS
- [ ] **Step 5: Commit** — `feat: dynamic logo + footer social links from settings`

---

### Task 10: Expand SETUP.md

**Files:**
- Modify: `SETUP.md`

- [ ] **Step 1: Add sections** (verify each against the actual implementation before writing): apply migrations 0013/0014; Daraja env vars (`MPESA_*`); Africa's Talking env vars (`AFRICASTALKING_*`) and the `sms_enabled`/`sms_provider` admin toggles; brand colours JSON; social links JSON; logo upload to the Supabase Storage bucket + `logo_url`; policy text; FAQ JSON; opening hours JSON; gallery content (showcase products in `products`).
- [ ] **Step 2: Verify accuracy** — every documented env var and setting exists in code.
- [ ] **Step 3: Commit** — `docs: expand SETUP.md with Phase 6/7 configuration checklist`

---

## Execution Order

`1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10`

Task 1 is the shared contract; every later task reads from it. Tasks 5 and 6 are new routes that depend on Task 1. Task 7 is independent of the public pages but uses the same settings. Tasks 8 and 9 both touch the public layout and should run in order to avoid conflicting edits.

## Migration / Deployment Instructions

- **No new migration is needed.** Migrations `0013_public_content.sql` and `0014_resellable_config.sql` already exist and are additive (`add column if not exists` with defaults). Apply them to any environment that hasn't run them yet (`supabase db push` or your usual migration path). They preserve existing data and do not alter RLS.
- Public exposure is limited to the columns `anon_read_settings` already exposes; no secrets are added to `settings`. Confirm no API credentials are ever inserted into a settings row.

## Self-Review Checklist

- [ ] Spec coverage: every Phase 6/7 item in AUDIT.md and REMEDIATION_PLAN.md addressed
- [ ] Step scan: each step is one action with a checkable result
- [ ] Type consistency: `PublicSettings` matches migrations 0013/0014; form fields match `updateSettings`
- [ ] Review Focus: all failure modes have owning tests
- [ ] Secrets: `sms_*` and provider credentials excluded from public output
- [ ] No duplicate ordering paths, no redesign, no new dependencies, no unrelated changes
