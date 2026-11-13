# P1-9: MFA for Superadmin — Implementation Plan

**Status:** Awaiting approval  
**Date:** 2026-11-12  
**Supabase Project:** `kkbiwdrpdtednndczwig`

---

## 1. Executive Summary

Implement **Supabase Auth native TOTP (AAL2)** for `superadmin` role only. No custom columns, no `otplib`. Enforce `aal2` in:
- Central middleware (every request)
- `requireUser()` / `getStaffSession()` (Server Components & API routes)
- RLS policies via `auth.jwt()->>'aal'`

**Break-glass:** Two enrolled factors + tested recovery procedure. No grace period.

---

## 2. Current Auth Architecture

### 2.1 Session Resolution Flow

```
Request → Middleware (supabase/middleware.ts) → createServerClient → auth.getUser()
         ↓
Server Component / API Route → requireUser() / getStaffSession(request)
         ↓
loadProfile(supabase, userId) → profiles table (role, active)
         ↓
Returns StaffSession { user: SessionUser, supabase: RLS-scoped client }
```

### 2.2 Middleware Files

| File | Purpose | Executes On |
|------|---------|-------------|
| `src/lib/supabase/middleware.ts` | Creates Supabase client bound to request/response; refreshes auth cookie | **Every request** via Next.js middleware (registered in `src/middleware.ts`) |
| `utils/supabase/middleware.ts` | Re-export only | — |

**Critical:** There is **no `src/middleware.ts`** in the repo root. The Supabase middleware client is **not automatically executed** on every request — it's a helper function. Auth guards live in:
- `requireUser()` → called in `src/app/admin/layout.tsx` (admin shell)
- `getStaffSession(request)` → called in each API route handler

**Gap:** Public API routes (`/api/orders`, `/api/mpesa/*`) call `getStaffSession(request)` but **do not require auth** — they allow anonymous access.

### 2.3 Routes That Can Bypass Auth Guard Today

| Route | Auth Required? | Role Check? |
|-------|----------------|-------------|
| `/admin/*` (Server Components) | Yes (`requireUser()` in layout) | Yes (`isAdminPathAllowed`, `can()`) |
| `/api/admin/*` | Yes (`getStaffSession(request)`) | Yes (per-route `can()`) |
| `/api/orders` (POST) | **No** | No |
| `/api/mpesa/callback` | **No** | No |
| `/api/mpesa/retry` | **No** | No |
| `/api/mpesa/status` | **No** | No |
| `/login` (action) | N/A | N/A |

---

## 3. Central Guard Proposal

### 3.1 Create `src/middleware.ts` (Next.js Middleware)

```typescript
// src/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "./src/lib/supabase/env";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — MUST be first
  const { data: { user } } = await supabase.auth.getUser();

  // ---- CENTRAL AAL2 ENFORCEMENT FOR SUPERADMIN ----
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "superadmin") {
      const aal = user.app_metadata?.aal || user.user_metadata?.aal;
      const isMfaRoute = request.nextUrl.pathname.startsWith("/admin/security/mfa");
      const isLoginRoute = request.nextUrl.pathname === "/login";
      const isApiAuthRoute = request.nextUrl.pathname.startsWith("/api/auth");

      if (aal !== "aal2" && !isMfaRoute && !isLoginRoute && !isApiAuthRoute) {
        // Redirect to MFA challenge (Server Component will render challenge UI)
        const url = request.nextUrl.clone();
        url.pathname = "/admin/security/mfa/challenge";
        url.searchParams.set("redirectTo", request.nextUrl.pathname);
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt
     * - public assets (images, fonts)
     * - API routes that MUST remain public (M-Pesa callbacks, order intake)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.png$|.*\\.jpg$|.*\\.svg$|api/orders|api/mpesa/callback|api/mpesa/retry|api/mpesa/status).*)",
  ],
};
```

### 3.2 Updated `requireUser()` — Double Enforcement

```typescript
// src/lib/session.ts (additions)
export const requireUser = async (): Promise<SessionUser> => {
  await connection();

  const session = await getStaffSession();
  if (!session) redirect("/login");

  // SECOND LAYER: Enforce AAL2 for superadmin even if middleware missed it
  if (session.user.role === "superadmin") {
    const { data: { user } } = await session.supabase.auth.getUser();
    const aal = user?.app_metadata?.aal || user?.user_metadata?.aal;
    if (aal !== "aal2") {
      redirect("/admin/security/mfa/challenge");
    }
  }

  return session.user;
};
```

### 3.3 Updated `getStaffSession(request)` — API Route Enforcement

```typescript
// src/lib/session.ts (additions in getStaffSession after loadProfile)
if (user.role === "superadmin") {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const aal = authUser?.app_metadata?.aal || authUser?.user_metadata?.aal;
  if (aal !== "aal2") {
    throw new Error("MFA_REQUIRED"); // API routes catch this → 403 + X-MFA-Required
  }
}
```

---

## 4. Supabase Native TOTP Enrollment Flow

### 4.1 Enrollment Page: `/admin/security/mfa/enroll`

**Server Component:**
```tsx
// src/app/admin/security/mfa/enroll/page.tsx
import { createClient } from "@/lib/supabase/server";

export default async function MfaEnrollPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect("/login");

  // Check if already enrolled
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors?.totp?.length > 0) {
    redirect("/admin/security/mfa/challenge");
  }

  // Enroll new TOTP factor
  const { data: factor, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Tamera WhatsApp Orders",
    friendlyName: user.email || "Superadmin",
  });

  if (error) throw error;

  return (
    <MfaEnrollView 
      qrCode={factor.totp?.qr_code} 
      secret={factor.totp?.secret}
      factorId={factor.id}
    />
  );
}
```

**Client Component (`MfaEnrollView`):**
- Renders QR code (`factor.totp.qr_code` is SVG data URI)
- Shows secret for manual entry
- Form: user submits 6-digit code → calls `/api/auth/mfa/verify` (see below)

### 4.2 Verification API: `/api/auth/mfa/verify`

```typescript
// src/app/api/auth/mfa/verify/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { factorId, code } = await request.json();

  const { data, error } = await supabase.auth.mfa.verify({
    factorId,
    code,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // data.aal = "aal2" — Supabase sets this in the session
  return NextResponse.json({ aal: data.aal });
}
```

### 4.3 Challenge Page: `/admin/security/mfa/challenge`

```tsx
// src/app/admin/security/mfa/challenge/page.tsx
"use client";

export default function MfaChallengePage() {
  // Client component: form with 6-digit input
  // On submit → supabase.auth.mfa.challenge({ factorId }) → poll for verification
  // Or use verify() directly with code
  // Success → redirect to original destination (from searchParams)
}
```

### 4.4 Recovery Codes (Break-Glass)

Supabase Auth **does not generate recovery codes natively**. We add a **custom recovery factor**:

```typescript
// Enrollment: after TOTP verified, generate 10 recovery codes
// Store as a "recovery_codes" factor (custom metadata on user)
const recoveryCodes = Array.from({ length: 10 }, () => 
  crypto.randomUUID().slice(0, 8).toUpperCase()
);

// Hash each with bcrypt (server-side only)
const hashedCodes = await Promise.all(recoveryCodes.map(c => bcrypt.hash(c, 12)));

// Store in user_metadata (encrypted by Supabase)
await supabase.auth.updateUser({
  data: { recovery_codes: hashedCodes }
});

// Show plaintext codes ONCE to user — they must save them
```

**Verification of recovery code:**
```typescript
// Custom API: /api/auth/mfa/recovery
// 1. Get user's hashed recovery_codes from user_metadata
// 2. bcrypt.compare(submittedCode, hashedCodes[i])
// 3. On match: remove that code from array, update user_metadata
// 4. Issue AAL2 session via supabase.auth.mfa.verify() with a dummy factor? 
//    Actually: recovery code grants a one-time AAL2 session.
//    Supabase doesn't support this natively — we use a "recovery" factor type.
//    
//    Better: Enroll a second TOTP factor as "backup" (printed QR), 
//    OR use Supabase's "phone" factor with a dedicated number.
//    
//    Simplest tested approach: 
//    - Generate 10 recovery codes
//    - Store hashed in user_metadata
//    - Custom verify endpoint: if code matches, call supabase.auth.mfa.challenge()
//      on the TOTP factor with a dummy challenge, then verify with a special bypass?
//    
//    Actually the cleanest: 
//    - User submits recovery code
//    - Server verifies hash match
//    - Server calls supabase.auth.setSession() with a service-role generated 
//      session that has aal2? No, can't forge AAL.
//    
//    **Recommended:** Use Supabase's native "backup codes" pattern:
//    Enroll a second TOTP factor labeled "Recovery Codes" with 10 pre-generated 
//    secrets. Each secret = one recovery code. User scans/prints all 10 QR codes.
//    When used, that factor is verified and removed.
//    
//    But Supabase only allows ONE TOTP factor per user.
//    
//    **Final decision:** Custom recovery codes in user_metadata + 
//    a dedicated verify endpoint that, on success, calls 
//    `supabase.auth.mfa.verify({ factorId: totpFactorId, code: "RECOVERY_USED" })`
//    — but that requires the TOTP secret.
//    
//    **Practical approach for this project:**
//    1. Enroll TOTP (primary)
//    2. Generate 10 recovery codes, store bcrypt hashes in user_metadata.recovery_codes
//    3. Custom verify endpoint checks hash, removes used code
//    4. On success: mint a short-lived AAL2 session by calling Supabase Admin API 
//       to update user's `app_metadata.aal = "aal2"` for 5 minutes? 
//       No — AAL is derived from factor verification.
//    
//    **Best available:** 
//    - Recovery code verification → call `supabase.auth.mfa.challenge({ factorId })` 
//      to get a challenge, then `verify({ factorId, challengeId, code: totpCode })`
//      — but user doesn't have TOTP.
//    
//    **Simpler:** Use Supabase's `phone` factor as second factor (SMS).
//    - Enroll phone factor with a dedicated Twilio number we control
//    - Recovery = SMS to that number (we receive in admin dashboard)
//    - Not ideal.
//    
//    **Decision for this plan:** 
//    Implement custom recovery codes stored in `user_metadata.recovery_codes` (hashed).
//    Verification endpoint:
//    - Validates hash
//    - Calls `supabase.auth.mfa.verify()` with the TOTP factor using a 
//      **server-generated TOTP code** (since server has the secret from enrollment? 
//      No, Supabase doesn't return secret after enrollment).
//    
//    **Actually:** Supabase returns `factor.totp.secret` ONCE at enrollment. 
//    We can store it encrypted in our DB (profiles.mfa_totp_secret_encrypted).
//    Then recovery verification → server generates valid TOTP → calls verify().
//    This requires the custom column we said no to.
//    
//    **Compromise:** Store TOTP secret encrypted in `profiles` at enrollment 
//    (one column, `mfa_totp_secret_enc`), ONLY for recovery code verification.
//    This is a single column, not the full custom MFA system.
//    
//    **Revised recovery plan:**
//    1. At enrollment: Supabase returns `factor.totp.secret` → encrypt with app key → store in `profiles.mfa_totp_secret_enc`
//    2. Generate 10 recovery codes → bcrypt hash → store in `user_metadata.recovery_codes`
//    3. Recovery verify: check hash → if valid, server generates TOTP from decrypted secret → calls `supabase.auth.mfa.verify({ factorId, code: generatedTotp })` → returns AAL2 session
//    4. Remove used recovery code from array
```

### 4.5 Break-Glass Procedure (Tested)

| Scenario | Procedure | Tested? |
|----------|-----------|---------|
| Superadmin loses authenticator | Use 1 of 10 recovery codes at `/admin/security/mfa/recovery` | **Must test in staging** |
| All recovery codes used | Second superadmin (if exists) enrolls MFA → disables first user's MFA via Admin API | **Must test** |
| Only superadmin locked out | Service-role script: `supabase.auth.admin.updateUserById(id, { user_metadata: { recovery_codes: [] }})` + re-enroll | **Must test** |
| Service-role access | Never requires MFA — uses `service_role` key, not user session | N/A |

**Break-Glass Admin API (superadmin-only):**
```typescript
// src/app/api/admin/users/[id]/mfa/reset/route.ts
// POST: resets MFA for target user (audit logged)
// Only callable by superadmin with AAL2
```

---

## 5. RLS Policies with AAL2

### 5.1 Current RLS (simplified)

```sql
-- Example: orders table
CREATE POLICY "Staff can view orders" ON orders
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM profiles WHERE active = true)
  );

CREATE POLICY "Staff can manage orders" ON orders
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE active = true AND role IN ('superadmin','manager'))
  );
```

### 5.2 Add AAL2 Requirement for Superadmin Actions

```sql
-- Superadmin write actions require AAL2
CREATE POLICY "Superadmin write requires AAL2" ON orders
  FOR INSERT, UPDATE, DELETE USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE active = true AND role = 'superadmin'
    )
    AND (auth.jwt()->>'aal') = 'aal2'
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE active = true AND role = 'superadmin'
    )
    AND (auth.jwt()->>'aal') = 'aal2'
  );

-- Manager actions: no AAL2 required
CREATE POLICY "Manager write" ON orders
  FOR INSERT, UPDATE, DELETE USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE active = true AND role = 'manager'
    )
  );

-- Sensitive reads (cost, profit, expenses) — superadmin only, AAL2 required
CREATE POLICY "Superadmin sensitive read requires AAL2" ON order_items
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE active = true AND role = 'superadmin'
    )
    AND (auth.jwt()->>'aal') = 'aal2'
  );
```

**Apply to tables:** `orders`, `order_items`, `products` (cost_price), `expenses`, `payments`, `profiles` (user management), `settings`.

---

## 6. Database Migration SQL

### 6.1 Single Column for Recovery Support

```sql
-- migration/0018_add_mfa_recovery_support.sql
BEGIN;

-- Encrypted TOTP secret for recovery code verification (server-side only)
ALTER TABLE profiles 
ADD COLUMN mfa_totp_secret_enc text;

-- Index for lookup (not strictly needed but clean)
CREATE INDEX idx_profiles_mfa_secret ON profiles (mfa_totp_secret_enc) 
WHERE mfa_totp_secret_enc IS NOT NULL;

-- RLS: only service_role and the user themselves can read this column
-- (Handled by not selecting it in normal queries; service_role bypasses RLS)

COMMIT;
```

### 6.2 RLS Policies for AAL2 (separate migration)

```sql
-- migration/0019_rls_aal2_superadmin.sql
BEGIN;

-- Helper function
CREATE OR REPLACE FUNCTION is_superadmin_with_aal2() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND active = true 
    AND role = 'superadmin'
  ) AND (auth.jwt()->>'aal') = 'aal2';
$$;

-- Orders: superadmin write requires AAL2
DROP POLICY IF EXISTS "Superadmin write requires AAL2" ON orders;
CREATE POLICY "Superadmin write requires AAL2" ON orders
  FOR INSERT, UPDATE, DELETE USING (is_superadmin_with_aal2())
  WITH CHECK (is_superadmin_with_aal2());

-- Order items: superadmin read cost/profit requires AAL2
DROP POLICY IF EXISTS "Superadmin sensitive read requires AAL2" ON order_items;
CREATE POLICY "Superadmin sensitive read requires AAL2" ON order_items
  FOR SELECT USING (
    -- Managers can read their fields
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND active = true AND role = 'manager')
    OR is_superadmin_with_aal2()
  );

-- Products: cost_price column protection via view or column-level RLS (PG15+)
-- Using view approach for compatibility:
CREATE OR REPLACE VIEW products_superadmin AS
SELECT *, cost_price FROM products
WHERE is_superadmin_with_aal2();

GRANT SELECT ON products_superadmin TO authenticated;

-- Expenses: superadmin only, AAL2
DROP POLICY IF EXISTS "Superadmin expenses AAL2" ON expenses;
CREATE POLICY "Superadmin expenses AAL2" ON expenses
  FOR ALL USING (is_superadmin_with_aal2())
  WITH CHECK (is_superadmin_with_aal2());

-- Payments: superadmin write AAL2
DROP POLICY IF EXISTS "Superadmin payments write AAL2" ON payments;
CREATE POLICY "Superadmin payments write AAL2" ON payments
  FOR INSERT, UPDATE, DELETE USING (is_superadmin_with_aal2())
  WITH CHECK (is_superadmin_with_aal2());

-- Profiles: user management (superadmin only, AAL2)
DROP POLICY IF EXISTS "Superadmin profiles manage AAL2" ON profiles;
CREATE POLICY "Superadmin profiles manage AAL2" ON profiles
  FOR INSERT, UPDATE, DELETE USING (is_superadmin_with_aal2())
  WITH CHECK (is_superadmin_with_aal2());

-- Settings: superadmin only, AAL2
DROP POLICY IF EXISTS "Superadmin settings AAL2" ON settings;
CREATE POLICY "Superadmin settings AAL2" ON settings
  FOR UPDATE USING (is_superadmin_with_aal2())
  WITH CHECK (is_superadmin_with_aal2());

COMMIT;
```

---

## 7. Rate Limiter Migration Plan

### 7.1 Current State

| Limiter | Type | Routes |
|---------|------|--------|
| `orderLimiter` | **In-memory** | `/api/orders` (POST) |
| `mpesaRetryLimiter` | **In-memory** | `/api/mpesa/retry` |
| `mpesaStatusLimiter` | **In-memory** | `/api/mpesa/status` |
| `mpesaCallbackLimiter` | **In-memory** | `/api/mpesa/callback` |
| `loginLimiter` | Distributed (Upstash) | `/login` |
| `adminReadLimiter` | Distributed (Upstash) | `/api/admin/*` GET |
| `adminWriteLimiter` | Distributed (Upstash) | `/api/admin/*` POST/PATCH/DELETE |
| `uploadLimiter` | Distributed (Upstash) | `/api/admin/product-image` |

### 7.2 Migration: Change 4 Limiters to Distributed

**File:** `src/lib/rate-limit.ts`

```typescript
// BEFORE
import { createRateLimiter } from "./rate-limit-internal";
export const orderLimiter = createRateLimiter({ limit: 6, windowMs: 60_000 });
export const mpesaRetryLimiter = createRateLimiter({ limit: 6, windowMs: 60_000 });
export const mpesaStatusLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
export const mpesaCallbackLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

// AFTER
import { createDistributedRateLimiter } from "./rate-limit-upstash";
export const orderLimiter = createDistributedRateLimiter({ limit: 6, windowMs: 60_000 });
export const mpesaRetryLimiter = createDistributedRateLimiter({ limit: 6, windowMs: 60_000 });
export const mpesaStatusLimiter = createDistributedRateLimiter({ limit: 60, windowMs: 60_000 });
// KEEP callback generous but distributed
export const mpesaCallbackLimiter = createDistributedRateLimiter({ limit: 120, windowMs: 60_000 });
```

### 7.3 Upstash Configuration

**Vercel Environment Variables (Production):**
- `UPSTASH_REDIS_REST_URL` — already set (used by login/admin/upload)
- `UPSTASH_REDIS_REST_TOKEN` — already set

**Development (`.env.local`):**
```bash
USE_LOCAL_RATE_LIMITER=true
# Or add Upstash dev credentials
```

**No code changes needed elsewhere** — same `RateLimiter` interface.

### 7.4 Prefix Strategy (avoid collisions)

```typescript
// rate-limit-upstash.ts — update prefix per limiter
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(limit, `${windowMs / 1000}s`),
  prefix: `rl:${prefixMap[limit]}`, // or pass prefix in options
  analytics: false,
});
```

Add `prefix` to `RateLimitOptions` and pass unique prefixes:
- `rl:order`
- `rl:mpesa_retry`
- `rl:mpesa_status`
- `rl:mpesa_callback`

---

## 8. Implementation Sequence

| Step | Description | Files |
|------|-------------|-------|
| 1 | Create `src/middleware.ts` (Next.js middleware) | New file |
| 2 | Update `requireUser()` with AAL2 check | `src/lib/session.ts` |
| 3 | Update `getStaffSession()` with AAL2 check | `src/lib/session.ts` |
| 4 | Add MFA enrollment page `/admin/security/mfa/enroll` | New: `page.tsx`, components |
| 5 | Add MFA challenge page `/admin/security/mfa/challenge` | New: `page.tsx` |
| 6 | Add MFA verify API `/api/auth/mfa/verify` | New: `route.ts` |
| 7 | Add recovery codes API `/api/auth/mfa/recovery` | New: `route.ts` |
| 8 | Add break-glass admin API `/api/admin/users/[id]/mfa/reset` | New: `route.ts` |
| 9 | Migration 0018: `mfa_totp_secret_enc` column | `supabase/migrations/0018_...sql` |
| 10 | Migration 0019: RLS AAL2 policies | `supabase/migrations/0019_...sql` |
| 11 | Update rate limiters to distributed | `src/lib/rate-limit.ts`, `rate-limit-upstash.ts` |
| 12 | Test in staging: enrollment, challenge, recovery, break-glass | — |
| 13 | Deploy to production | — |

---

## 9. Testing Checklist (Staging)

- [ ] Superadmin enrolls TOTP → QR scans → first code verifies → AAL2 session
- [ ] Superadmin without AAL2 redirected to challenge on `/admin/*`
- [ ] API routes return 403 `X-MFA-Required` for superadmin without AAL2
- [ ] RLS blocks superadmin writes without AAL2
- [ ] Recovery code works → grants AAL2 session
- [ ] Break-glass: second superadmin resets first's MFA
- [ ] Rate limiters share state across instances (verify with 2+ preview deployments)
- [ ] M-Pesa callbacks still work (callback limiter generous)
- [ ] Login limiter still uses Upstash
- [ ] No regression on manager flows (no AAL2 required)

---

## 10. Rollback Plan

| Component | Rollback |
|-----------|----------|
| Middleware | Delete `src/middleware.ts` |
| Session checks | Revert `requireUser()` / `getStaffSession()` |
| MFA pages | Delete `/admin/security/mfa/*` |
| Migrations | `supabase migration down` (0019, then 0018) |
| Rate limiters | Revert `src/lib/rate-limit.ts` to `createRateLimiter` |

---

## 11. Approval Request

**Please confirm:**

1. ✅ Central middleware approach (new `src/middleware.ts` with matcher exclusions)
2. ✅ Supabase native TOTP only (no `otplib`, no custom MFA tables)
3. ✅ Single `mfa_totp_secret_enc` column for recovery support
4. ✅ No grace period — enforce immediately after enrollment
5. ✅ Recovery codes: 10 codes, bcrypt in `user_metadata`, server-generated TOTP for verification
6. ✅ Break-glass: tested recovery + second superadmin reset + service-role script
7. ✅ RLS policies using `auth.jwt()->>'aal' = 'aal2'` for superadmin write/sensitive read
8. ✅ Rate limiters: migrate 4 in-memory → distributed (Upstash), keep callback generous
9. ✅ Implementation sequence as above

**Reply "APPROVED" to proceed, or request changes.**