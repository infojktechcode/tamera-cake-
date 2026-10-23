export const meta = {
  name: 'phase-3-completion',
  description: 'Implement the full Phase 3 completion plan from 2026-10-22-phase3-completion.md: upload route, photo wiring, /cart page, cart correctness, security headers, e2e spec, DECISIONS section, README update — then verify with tests, typecheck, lint, build, e2e and DB checks.',
  phases: [
    { title: 'Plan & read', detail: 'Read the deliverable doc + supporting libs; confirm what exists now before writing.' },
    { title: 'Task 7 — signed photo upload route', detail: 'upload schema, photo-paths, route, photo-compress.' },
    { title: 'Task 8 — wire photos through the cart', detail: 'Cart type change, store fix, CakeBuilder step 4, CheckoutForm payload.' },
    { title: 'Task 9 — /cart page', detail: '/cart route + CartView component.' },
    { title: 'Task 10 — cart correctness', detail: 'order-compute with date/time, removeItem id contract, deposit parity, updater fix.' },
    { title: 'Task 11 — security headers', detail: 'next.config.ts CSP + headers block.' },
    { title: 'Task 12 — e2e + docs', detail: 'Playwright spec, DECISIONS.md Phase 3 section, README update.' },
    { title: 'Verification', detail: 'vitest, tsc, eslint, next build, playwright, check-supabase.' },
  ],
};

// Phase 0 — confirm the codebase state and read the plan.
const plan = [
  () => agent('Return the FULL verbatim contents of .worktrees/phase3-ordering/docs/superpowers/plans/2026-10-22-phase3-completion.md. Include the defects table and tasks section exactly.', { schema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } }),
  () => agent('List every file under src/, app/, api/, components/, components/public/, components/admin/, lib/, types/, supabase/, scripts/, e2e/. Return exact paths as JSON array of strings.', { schema: { type: 'array', items: { type: 'string' } } }),
  () => agent('Return the contents of src/lib/pricing.ts, src/lib/rules.ts, src/lib/whatsapp.ts, src/lib/catalog.ts. Quote key exported names.', { schema: { type: 'object', properties: { outputs: { type: 'object' } }, required: ['outputs'] } }).catch(() => ({ outputs: {} })),
].map(f => () => f());
log('Phase 0 / Plan + codebase');

// Task 7 — standalone verifier BEFORE implementation (adversarial refute check).
const t7pre = [
  () => agent('Is src/lib/validators/upload.schema.ts present? Quote its contents or say null.', { schema: { type: 'object', properties: { ok: { type: 'boolean' }, content: { type: 'string' } }, required: ['ok'] } }),
  () => agent('Is src/lib/photo-paths.ts present? Quote contents or null.', { schema: { type: 'object', properties: { ok: { type: 'boolean' }, content: { type: 'string' } }, required: ['ok'] } }),
].map(f => () => f());
log(`Phase 0 pre-check: ${JSON.stringify(t7pre[0].ok && t7pre[1].ok ? 'files absent — will create' : 'already exist')}`);

// === Implementation — each task as an independent agent writing files ===

const t7write = [
  () => agent(
    'Write these four files now, using only stable Next 16 / TypeScript patterns per AGENTS.md. Do NOT run any editor or test runner — just Write the files.\n\nFile 1 — src/lib/validators/upload.schema.ts:\nStrict Zod schema for a single cake reference photo upload:\n  - name: string, min 1, max 80\n  - mime: string enum ["image/jpeg","image/png","image/webp"]\n  - size: z.number().int().positive().max(5 * 1024 * 1024)\nExport as `PhotoUploadInput`. Strict mode (z.string().strict(), no coercion).\n\nFile 2 — src/lib/photo-paths.ts:\nPure helpers: \n  buildCakeReferencePath(mime: "image/jpeg"|"image/png"|"image/webp") => string storage path like `cake-references/<yyyy>/<mm>/<uuid>.jpg` (jpeg always .jpg;\npng/.webp keep extension)\n  buildReferenceImageUrl(path: string) => `${SITE_URL}/storage/${path}` where SITE_URL comes from process.env.NEXT_PUBLIC_SITE_URL ?? ""; export both as named exports.\n\nFile 3 — src/app/api/upload/route.ts:\nPOST handler:\n  - rate limit by IP (simple in-memory map; 1 request / 5s per IP; throw 429 on breach)\n  - read multipart body, parse fields.name, fields.mime, fields.size\n  - validate with PhotoUploadInput\n  - fetch POST createSignedUploadUrl on supabase project \\\`cake-references\\\` bucket (service key; RLS handles the rest) -> {path, token}\n  - return { ok: true, path, url }\nOn any failure return { ok: false, error } with HTTP 400 / 429.\nUse Next 16 generateRouteFor => Request + Fetch API for PostgREST. Service key via src/lib/supabase/service.ts getSupabaseService().\n\nFile 4 — src/lib/photo-compress.ts:\nbest-effort client-resize: load File -> createImageBitmap -> canvas at max 1600px wide -> JPEG 0.8 quality -> Blob; if any error returns original file unchanged. Export function compressReferencePhoto(file: File, maxWidth = 1600): Promise<Blob>.\nEach function must be testable with small pure helpers exposed for testing (expose exports + a `sizeOf` helper).',
    { label: 'task-7', isolation: 'worktree' }
  ),
].map(f => () => f());

const t8write = [
  () => agent(
    'Update these files:\n\nFile 1 — src/types/cart.ts:\nChange CakeCartItem.referencePhotos from File[] to string[] (storage paths).\nKeep everything else intact. The cart item kind stays "cake".\n\nFile 2 — src/lib/cart-store.ts:\n  - drop the `partialize` strip of referencePhotos entirely so sessionStorage persists paths.\n  - removeItem id contract: match cakes by (kind === "cake" && flavourId === id) AND pastries by (kind === "pastry" && productId === id) — i.e. pass the actual cake flavourId (or pastry productId), never the nonexistent "cake-<uuid>". Keep the existing predicate shape.\n  - addCake also accepts optional dateNeeded/timeNeeded/deliveryZone and stores them on the stored cake item, so order-level data survives checkout.\n  - expose helper `cakeId(flavourId)` returning "cake-<flavourId>" for stable removal ids.\n\nFile 3 — src/components/public/CakeBuilder.tsx:\nRewrite step 4 (PhotoUpload) to:\n  - compress via src/lib/photo-compress.ts\n  - request signed URL from src/app/api/upload/route.ts\n  - POST multipart to upload the blob with field name=file, name=displayName, mime=originalMime, size=byteLength\n  - on success setForm(...referencePhotos: [{path}]); surface inline errors via alert, never inside a setForm updater.\nRemove the old setPhotoError impure updater. Ensure deposit shown only when depositRequired > 0 (so quote-only tiers never show a deposit).\nAlso capture pickupDate + deliveryZone into form state now that they survive into checkout (dateNeeded / deliveryZone on addCake).\n\nFile 4 — create src/components/public/CheckoutForm.tsx:\nProps: initialForm, totals info. Payload sent to POST /api/orders must include real referencePhotos: string[] paths (not []), plus the cake dateNeeded and deliveryZone when present. Deposit shown only when the order-compute dep is > 0 (parity with server).\nKeep the rest of the component shape intact; you are fixing the payload and the deposit branch.',
    { label: 'task-8', isolation: 'worktree' }
  ),
].map(f => () => f());

const t9write = [
  () => agent(
    'Create these two files:\n\nFile 1 — src/app/(public)/cart/page.tsx:\nA client component page rendering <CartView />. Empty state: a friendly placeholder card with a button to /pastries.\n\nFile 2 — src/components/public/CartView.tsx:\nProps: { items: CartItem[]; removeItem(id: string): void }. Renders:\n  - header with subtotal + deposit hint line\n  - each item: name, Qty, line total, remove button\n  - footer: total, "Checkout CTA" link to /checkout\n  - empty state card\nUse the existing ui primitives under src/components/ui/ (button, card, input maybe). Reuse the mobile-first dark palette already in place (bg-gray-900 text-white in CakeBuilder).\n\nBoth files must compile cleanly and pass the existing vitest test imports (cartTotal, itemCount, hasCakes from ../lib/cart-store).\nReturn true once written; quote nothing except confirming creation.',
    { label: 'task-9', isolation: 'worktree' }
  ),
].map(f => () => f());

const t10write = [
  () => agent(
    'Create src/lib/order-compute.ts computing order-level cart details:\nInputs: cake: Omit<CakeCartItem,"kind">, pastry: PastryCartItem[], dateNeeded?: string, deliveryZone?: {id,name,fee}, settings: OrderSettings {\nmin_lead_days, daily_limit, deposit_percent, deposit_threshold_kg}\nOutputs:\n  dateCheck: DateCheck\n  neededDate string|null  (computed for the customer; leave null if no date chosen)\n  deliveryZone details or null\n  cakeSubtotal, pastrySubtotal, total\n  deposit (same rule as pricing.depositRequired — anyCakeOverThreshold OR anyNonSimpleTier; quote-only tiers never trigger)\n  isQuoteRequired: boolean (tierRequiresQuote is true OR deposit == 0)\n  fulfilment: "pickup" | "delivery" chosen from deliveryZone presence (default pickup if no zone)\n\nShare the exact same deposit decision logic as src/lib/pricing.ts depositRequired so parity holds.\nExport functions cakePrice, pastryLineTotal, cartSubtotal, depositParity, orderCompute and a re-export of depositRequired used by the UI.\nKeep it pure & unit-testable.',
    { label: 'task-10', isolation: 'worktree' }
  ),
].map(f => () => f());

const t11write = [
  () => agent(
    'Edit src/next.config.ts to add:\n  - headers (server) with:\n      Content-Security-Policy: "default-src \'self\'"; img-src 'self' https: data: blob:; media-src 'self' blob:; connect-src 'self' https:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors \'none\';\n      X-Content-Type-Options: nosniff;\n      Referrer-Policy: strict-origin-when-cross-origin;\n      Permissions-Policy: geolocation=(), microphone=(), camera=();\n  The CSP must allow Supabase Studio / image hosts (https:) and inline styles (Tailwind v4 uses them).\nKeep all existing config intact.\nReturn true after editing and quote the headers block.',
    { label: 'task-11', isolation: 'worktree' }
  ),
].map(f => () => f());

const t12write = [
  () => agent(
    'Create three files:\n\nFile 1 — e2e/order-journey.spec.ts (Playwright, TS):\nConfigure from src/playwright.config.ts if present, else minimal config importing ../../playwright.config.ts defaults.\nTest: login as owner (or use public anon flow), go to /cakes, open a cake page at viewport 360x640, click "Build Your Cake", complete steps 1-6, step 4 uploads a real file (create a fixture BlobFile in the test context or use a fixture `samplePhoto`), step 7 adds to cart, navigate to /cart, assert items render with total >= cake price, click Checkout, assert redirect to /checkout or confirmation page (depends on Step 13 wiring — focus on flow to /cart + checkout). Assert total displayed equals cakePrice * kg on the summary. Quote every selector you use.\nUse `test.describe.serial` and clear user-action language. Don\'t call Supabase directly in the spec — drive the UI.\n\nFile 2 — docs/DECISIONS.md:\nAppend a new section titled ## 8. Phase 3 (ordering completion)\nSummarize: what was built, why (defects D1-D7 closed), how the photos now live, what could still break.\nBe concise, deterministic, no speculation beyond the verified state.\n\nFile 3 — README.md:\nUpdate: add a "## Admin screens (Phase 5)" is already there; ADD a "## Phase 3 (ordering completion)" subsection listing the admin screens added in Phase 3, the customer journey end-to-end, env vars (SITE_URL, SHOP_WHATSAPP), and the WhatsApp click-to-chat limitation paragraph from the plan ("the WhatsApp button only opens a chat…").\nIf those sections overlap with existing content, consolidate.\n\nReturn true after writing each file and quote a short snippet from each so I can double-check against the plan.',
    { label: 'task-12', isolation: 'worktree' }
  ),
].map(f => () => f());

log('Phase 1 / Task implementations');

// Phase 2 — verification. Run every command in parallel where possible.
const tests = [
  () => agent('Run `npx vitest run` in the repo root. Quote the last 6 lines including Passed/Failed counts. Note any errors.', { schema: { type: 'object', properties: { ok: { type: 'boolean' }, count: { type: 'string' }, lines: { type: 'string' } }, required: ['ok', 'lines'] } }),
].map(f => () => f());

const verify = [
  () => agent('Run `npx tsc --noEmit` in the repo root. Quote exit code and any errors (if zero, say PASS).', { schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } }),
  () => agent('Run `npx eslint .` in the repo root. Quote exit code and any errors.', { schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } }),
  () => agent('Run `npx next build` in the repo root. Quote the final lines showing green status and list the routes including /cart if present.', { schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } }),
].map(f => () => f());

const db = [
  () => agent('Run `node scripts/check-supabase.mjs` against the live Supabase project. Quote PASS/FAIL and any discrepancy counts.', { schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } }),
].map(f => () => f());

const e2e = [
  () => agent('Run Playwright e2e from the repo root with env E2E_BASE_URL=http://localhost:3000. Quote test result counts (Passed/Failed/Skipped). If the server is not running, note that and skip gracefully — do not crash.', { schema: { type: 'object', properties: { ok: { type: 'boolean' }, note: { type: 'string' } }, required: ['ok'] } }),
].map(f => () => f());

const review = [
  () => agent(
    'Cross-check every verdict below against the freshly written files. For each FAIL task, confirm whether a fix is genuinely missing or whether the verification command missed something. Do NOT fabricate — read the files again yourself.\n\nPer defect evidence in the plan: D1 (cart route missing) D2 (photos not uploaded) D3 (date/zone discarded) D4 (removeItem id contract) D5 (deposit parity) D6 (impure updater) D7 (security headers).\nReport: for each task PASS/FAIL, the concrete evidence that backs it, and the list of remaining risks if any.',
    { schema: { type: 'object', properties: { summary: { type: 'string' }, risks: { type: 'array', items: { type: 'string' } } }, required: ['summary'] } } }
  ),
].map(f => () => f());

log('Phase 2 / Verification');

const vResults = {
  tests: await parallel(tests),
  verify: await parallel(verify),
  db: await parallel([db]),
  e2e: await parallel(e2e),
  review: await parallel([review]),
};

return {
  plan: plan[1],
  verifications: vResults,
  reviewer: review[0],
};
