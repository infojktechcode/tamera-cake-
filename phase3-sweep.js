export const meta = {
  name: 'phase-3-completion-sweep',
  description: 'Exhaustively audit whether each Phase 3 task from 2026-10-22-phase3-completion.md is implemented; return a verified pass/fail table per task.',
  phases: [
    { title: 'Map workspace', detail: 'List every relevant file and read the deliverable doc.' },
    { title: 'Task 7 (upload route)', detail: 'Verify upload schema, photo-paths, upload route, photo-compress.' },
    { title: 'Task 8 (wire photos)', detail: 'Verify cart type, store, CakeBuilder step 4, CheckoutForm referencePhotos.' },
    { title: 'Task 9 (/cart route)', detail: '/cart page exists? CartView component?' },
    { title: 'Task 10 (cart correctness)', detail: 'date/time/fulfilment, removeItem id contract, deposit parity, impure updater fix.' },
    { title: 'Task 11 (security headers)', detail: 'next.config.ts CSP + headers.' },
    { title: 'Task 12 (e2e + docs)', detail: 'Playwright spec, DECISIONS.md section, README update.' },
    { title: 'Aggregate verdict', detail: 'Cross-check verify against facts; mark D1-D7 per defect evidence.' },
  ],
};

// Phase 0 — discover what exists and read every deliverable doc in parallel.
const map = [
  () => agent('Return the EXACT list of files under src/, app/, api/, components/, lib/, types/, supabase/, scripts/, e2e/. List every path, including one level deep under each directory. Also list every *.md under the repo root and .worktrees/. Return as JSON array of strings.', { schema: { type: 'array', items: { type: 'string' } } }),
  () => agent('Return the FULL verbatim contents of .worktrees/phase3-ordering/docs/superpowers/plans/2026-10-22-phase3-completion.md. Include the defects table, tasks, and verification section.', { schema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } }),
].map(f => () => f());
log('Phase 0 / Map workspace');

// Tasks 7–12 — independent verifiers, each driven by its own phase title so progress groups correctly.
const t7 = [
  () => agent('Does src/lib/validators/upload.schema.ts exist with a Zod schema containing name + mime type (jpg/png/webp) + size ≤ 5MB? Quote the schema.', { schema: { type: 'object', properties: { ok: { type: 'boolean' }, code: { type: 'string' } }, required: ['ok', 'code'] } }),
  () => agent('Does src/lib/photo-paths.ts exist exporting pure helpers that build the storage path from the validated mime type (NOT the client filename) AND build the public URL for a stored path? Return the exported function names.', { schema: { type: 'object', properties: { ok: { type: 'boolean' }, fns: { type: 'array', items: { type: 'string' } }, detail: { type: 'string' } }, required: ['ok', 'fns'] } }),
  () => agent('Does src/app/api/upload/route.ts exist and POST → rate limit by IP → validate → createSignedUploadUrl on cake-references → return {path, token}? Quote the request handler.', { schema: { type: 'object', properties: { ok: { type: 'boolean' }, code: { type: 'string' } }, required: ['ok', 'code'] } }),
  () => agent('Does src/lib/photo-compress.ts exist with best-effort client-side resize at 1600px JPEG 0.8 with a safe fallback to the original file? Confirm or deny with a short codequote.', { schema: { type: { type: 'boolean' }, detail: { type: 'string' } } }),
].map(f => () => f());

const t8 = [
  () => agent('In src/types/cart.ts, is CakeCartItem.referencePhotos now string[] (storage paths)? What is the other cake-related type field set, and which variant is used by pastry items? Return kind ("cake" or "pastry").', { schema: { type: 'object', properties: { kind: { type: 'string' }, refsType: { type: 'string' } }, required: ['kind'] } }),
  () => agent('In src/lib/cart-store.ts, do photos persist (no strip on persist)? Where is removeItem defined, and does the id predicate match by cake flavourId AND pastry productId? Quote the predicate.', { schema: { type: { type: 'boolean' }, detail: { type: 'string' }, code: { type: 'string' } } }),
  () => agent('In src/components/public/CakeBuilder.tsx, does step 4 compress, request a signed URL, upload, and store the storage path — no longer File objects? Quote the upload handler and confirm there is no leftover setPhotoError impure updater.', { schema: { type: { type: 'boolean' }, detail: { type: 'string' }, code: { type: 'string' } } }),
  () => agent('In src/components/public/CheckoutForm.tsx, does it send real referencePhotos paths (not [])? Quote the payload field name and shape.', { schema: { type: { type: 'boolean' }, detail: { type: 'string' }, code: { type: 'string' } } }),
].map(f => () => f());

const t9 = [
  () => agent('Do both src/app/(public)/cart/page.tsx and src/components/public/CartView.tsx exist? Quote the route registration if there is one. If either is missing, mark null and say which.', { schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } }),
];

const t10 = [
  () => agent('Does src/lib/order-compute.ts compute order-level details dateNeeded/timeNeeded/fulfilment AND share the deposit rule with computeOrder so quote-only tiers never show a deposit? Quote both functions.', { schema: { type: { type: 'boolean' }, detail: { type: 'string' }, code: { type: 'string' } } }),
  () => agent('In src/components/public/CartDrawer.tsx, does removeItem use a stable cake id based on flavourId rather than "cake-<uuid>"? Quote the match predicate.', { schema: { type: { type: 'boolean' }, detail: { type: 'string' }, code: { type: 'string' } } }),
  () => agent('In src/components/public/CakeBuilder.tsx and/or CheckoutForm.tsx, is the deposit rendered only when depositRequired returns > 0 (matching computeOrder)? Quote the condition branch.', { schema: { type: { type: 'boolean' }, detail: { type: 'string' }, code: { type: 'string' } } }),
  () => agent('Has the impure React updater been fixed (setPhotoError removed from inside setForm)? Is URL.createObjectURL revoked on unmount? Quote the current implementation or confirm the fix.', { schema: { type: { type: 'boolean' }, detail: { type: 'string' }, code: { type: 'string' } } }),
].map(f => () => f());

const t11 = [
  () => agent('Does next.config.ts include Content-Security-Policy with Supabase URLs and image hosts, frame-ancestors "none", X-Content-Type-Options, Referrer-Policy, Permissions-Policy? Quote the headers block.', { schema: { type: { type: 'boolean' }, detail: { type: 'string' }, code: { type: 'string' } } }),
];

const t12 = [
  () => agent('Does e2e/order-journey.spec.ts exist covering a Playwright run at 360px for a full mixed order? Quote what it asserts.', { schema: { type: { type: 'boolean' }, detail: { type: 'string' } } }),
  () => agent('Is there a new section in docs/DECISIONS.md specifically about Phase 3? Return the heading line if present, else false.', { schema: { type: { type: 'boolean' }, heading: { type: 'string' } } }),
  () => agent('Was README.md updated with setup, env vars, seeding, deployment, and the WhatsApp click-to-chat limitation? Quote the new env vars table and the final limitation paragraph if present, else false.', { schema: { type: { type: 'boolean' }, detail: { type: 'string' } } }),
];

log('Phase 1 / Tasks 7–12 verification runs');

const results = {
  map: await parallel(map),
  t7: await parallel(t7),
  t8: await parallel(t8),
  t9: await parallel(t9),
  t10: await parallel(t10),
  t11: await parallel(t11),
  t12: await parallel(t12),
};

// Phase 2 — aggregate into a single verified verdict per task, anchored on the doc plan.
log('Phase 2 / Aggregate verdicts');
const verdicts = [];
verdicts.push({
  task: 'Task 7 — signed photo upload route',
  status: results.t7[0].ok && results.t7[1].ok && results.t7[2].ok && results.t7[3].ok ? 'PASS' : 'FAIL',
  details: JSON.stringify(results.t7, null, 0),
});
verdicts.push({
  task: 'Task 8 — wire photos through the cart',
  status: results.t8[0].ok && results.t8[1].ok && results.t8[2].ok && results.t8[3].ok ? 'PASS' : 'FAIL',
  details: JSON.stringify(results.t8, null, 0),
});
verdicts.push({ task: 'Task 9 — the missing /cart page', status: results.t9[0].ok ? 'PASS' : 'FAIL', details: '' });
verdicts.push({
  task: 'Task 10 — cart correctness (date/time/removeItem/deposit/updater)',
  status: results.t10[0].ok && results.t10[1].ok && results.t10[2].ok && results.t10[3].ok ? 'PASS' : 'FAIL',
  details: JSON.stringify(results.t10, null, 0),
});
verdicts.push({ task: 'Task 11 — security headers', status: results.t11[0].ok ? 'PASS' : 'FAIL', details: '' });
verdicts.push({
  task: 'Task 12 — e2e + docs',
  status: results.t12[0].ok && results.t12[1] && results.t12[2] ? 'PASS' : 'FAIL',
  details: JSON.stringify(results.t12, null, 0),
});

return {
  plan: '',
  verifications: results,
  verdicts,
};
