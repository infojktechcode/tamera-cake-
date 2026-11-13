# MFA Rollout Runbook

## Overview

This runbook covers the staged rollout of mandatory MFA (AAL2) for superadmin accounts. The enforcement is controlled by the `NEXT_PUBLIC_ENFORCE_MFA` environment variable (default: `false`).

## Prerequisites

1. **Supabase Project**: MFA provider (TOTP) enabled in Authentication > MFA
2. **Upstash Redis**: Configured for distributed rate limiting
3. **Service Role Key**: Available for recovery code storage and break-glass MFA reset
4. **Environment Variables** (Vercel Production):

```bash
# Required for MFA
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Required for rate limiting (Upstash)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Feature flag (default false)
NEXT_PUBLIC_ENFORCE_MFA=false
```

## Architecture Summary

- **MFA Method**: Supabase Auth native TOTP only (`auth.mfa.enroll/verify`)
- **Recovery Codes**: 10 codes, bcrypt-hashed, stored in service-only table `mfa_recovery_codes`
- **RLS**: RESTRICTIVE policies on sensitive tables requiring `current_aal() = 'aal2'` for superadmin
- **Enforcement Points**:
  1. `proxy.ts` (central middleware guard)
  2. `getStaffSession()` / `requireUser()` (double enforcement in server components)
- **Exclusions**: `/admin/security/mfa/*`, `/login`, `/api/auth/*` accessible at AAL1

## Phase 1: Staging Deployment (Enforcement OFF)

### 1.1 Deploy to Staging

```bash
# Deploy current branch to Vercel staging
vercel --scope=team --prod=false
```

### 1.2 Verify Infrastructure

- [ ] Supabase MFA provider (TOTP) enabled
- [ ] Migrations 0018 and 0019 applied to staging database
- [ ] Upstash Redis connected (check rate limiter logs)
- [ ] Service role key works for admin API calls

### 1.3 Create Test Superadmin Account

```sql
-- In Supabase Dashboard > SQL Editor
INSERT INTO profiles (id, email, full_name, role, active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'staging-superadmin@test.com',
  'Staging Superadmin',
  'superadmin',
  true
);
```

### 1.4 Enroll Two TOTP Factors

**Factor 1: Primary Authenticator App**

1. Sign in as staging superadmin at `https://staging.yourapp.com/login`
2. Navigate to `/admin/security/mfa/enroll`
3. Scan QR code with authenticator app (Google Authenticator, 1Password, etc.)
4. Enter 6-digit code to verify
5. **Save the 10 recovery codes** shown after verification
6. Verify redirect to `/admin` works (AAL2 session established)

**Factor 2: Backup Authenticator (Different Device/App)**

1. Sign out completely
2. Sign in again (will prompt for MFA challenge at `/admin/security/mfa/challenge`)
3. Use recovery code from Factor 1 to remove MFA (redirects to enroll)
4. Enroll a SECOND factor on a different device/app
5. Verify again and save NEW recovery codes
6. Test both factors work independently

### 1.5 Verify AAL1 Access Still Works (Flag OFF)

With `NEXT_PUBLIC_ENFORCE_MFA=false` (default):

- [ ] Superadmin at AAL1 can access `/admin` (no redirect to challenge)
- [ ] Superadmin at AAL1 can access `/admin/security/mfa/enroll`
- [ ] Superadmin at AAL1 can access `/admin/security/mfa/challenge`
- [ ] Superadmin at AAL1 can read own profile via `self_profile_read` policy
- [ ] Manager at AAL1 can access all manager routes
- [ ] Rate limiters work (check Upstash dashboard)

### 1.6 Test Recovery Flow

1. Sign in as superadmin
2. Go to `/admin/security/mfa/challenge`
3. Click "Use recovery code instead"
4. Enter one recovery code
5. Verify:
   - MFA factor is removed (check Supabase Auth > Users > MFA factors)
   - Redirected to `/admin/security/mfa/enroll`
   - No AAL2 session granted
   - Must re-enroll TOTP to regain superadmin access

### 1.7 Test Break-Glass Admin MFA Reset

```bash
# Using service role key
curl -X POST https://staging.yourapp.com/api/admin/users/<superadmin-id>/mfa/reset \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json"
```

Verify:
- [ ] MFA factor removed for target user
- [ ] Target user must re-enroll on next sign-in
- [ ] Caller must be superadmin with AAL2

---

## Phase 2: Staging Enforcement ON

### 2.1 Enable Enforcement Flag

In Vercel Staging Environment Variables:
```
NEXT_PUBLIC_ENFORCE_MFA=true
```

Redeploy staging:
```bash
vercel --scope=team --prod=false
```

### 2.2 Verify Enforcement Active

- [ ] Superadmin at AAL1 redirected to `/admin/security/mfa/challenge` for any `/admin/*` route
- [ ] Superadmin at AAL1 CAN still access `/admin/security/mfa/enroll` and `/admin/security/mfa/challenge`
- [ ] Superadmin at AAL1 CAN still read own profile (required for session loading)
- [ ] Superadmin at AAL2 can access all admin routes
- [ ] Manager at AAL1 unaffected (can access all manager routes)
- [ ] RLS policies block superadmin@AAL1 writes to orders, expenses, payments, settings
- [ ] RLS policies block superadmin@AAL1 reads on `order_items_sensitive` view

### 2.3 Test Edge Cases

- [ ] Bearer token API calls: superadmin@AAL1 gets 401 MFA_REQUIRED
- [ ] Cookie session: superadmin@AAL1 redirected to challenge
- [ ] Recovery flow still works (removes MFA, forces re-enroll)
- [ ] Rate limiter fail-open/fail-closed behavior:
  - Simulate Redis outage (disable Upstash temporarily)
  - Verify `/api/orders` and `/api/mpesa/callback` still work (fail open)
  - Verify `/api/auth/login` blocks (fail closed)

---

## Phase 3: Production Rollout

### 3.1 Pre-Production Checklist

- [ ] All staging tests pass
- [ ] Two superadmins have enrolled TWO factors each (primary + backup)
- [ ] Recovery codes stored securely (password manager, printed)
- [ ] Break-glass procedure documented and tested
- [ ] On-call engineer briefed on MFA recovery process
- [ ] Rollback plan ready (set `NEXT_PUBLIC_ENFORCE_MFA=false`)

### 3.2 Enable in Production

In Vercel Production Environment Variables:
```
NEXT_PUBLIC_ENFORCE_MFA=true
```

Deploy to production:
```bash
vercel --scope=team --prod
```

### 3.3 Post-Deployment Verification (First 30 Minutes)

- [ ] Superadmin sign-in works with MFA
- [ ] No "MFA_REQUIRED" errors for enrolled superadmins
- [ ] Manager access unaffected
- [ ] Order intake (`/api/orders`) working
- [ ] M-Pesa callbacks working
- [ ] Check Sentry/Logs for unexpected MFA_REQUIRED errors

### 3.4 Monitoring (First 24 Hours)

- [ ] Watch for authentication errors in logs
- [ ] Verify rate limiter metrics in Upstash dashboard
- [ ] Confirm no legitimate traffic blocked by fail-closed login limiter
- [ ] Check that superadmins can complete all admin workflows

---

## Break-Glass Procedures

### Scenario 1: Superadmin Lost All Factors + Recovery Codes

**Option A: Another Superadmin (with AAL2) Resets MFA**

```bash
curl -X POST https://app.yourapp.com/api/admin/users/<target-user-id>/mfa/reset \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json"
```

**Option B: Direct Database Access (Emergency Only)**

```sql
-- Remove MFA factor via Supabase Admin API (preferred)
-- OR delete from auth.mfa_factors directly (last resort)
DELETE FROM auth.mfa_factors WHERE user_id = '<user-id>' AND factor_type = 'totp';
```

Then user re-enrolls at `/admin/security/mfa/enroll`.

### Scenario 2: Rate Limiter Redis Outage

- **Order/Callback APIs**: Fail open (traffic continues)
- **Login API**: Fail closed (blocked) — verify Upstash status, restore quickly
- **Admin APIs**: Fail closed (default) — monitor for impact

### Scenario 3: Need to Disable Enforcement Urgently

```bash
# In Vercel CLI
vercel env add NEXT_PUBLIC_ENFORCE_MFA production
# Enter: false
vercel --scope=team --prod
```

---

## Rollback Plan

If critical issues arise:

1. **Immediate**: Set `NEXT_PUBLIC_ENFORCE_MFA=false` in Vercel Production, redeploy
2. **Within 5 min**: Verify superadmin@AAL1 can access admin again
3. **Investigate**: Check logs, fix issue, re-test in staging
4. **Re-enable**: After fix validated, re-enable flag

---

## Maintenance

### Adding New Superadmin

1. Create user in Supabase Auth
2. Add profile with `role = 'superadmin'`
3. User signs in, enrolls TOTP (two factors recommended)
4. User saves recovery codes securely

### Rotating Service Role Key

1. Generate new service role key in Supabase Dashboard
2. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel
3. Redeploy
4. Verify recovery code generation and admin MFA reset still work

### Updating Rate Limit Thresholds

Edit `src/lib/rate-limit.ts`, adjust `limit`/`windowMs` values, deploy.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Superadmin@AAL2 blocked | JWT `aal` claim not updated | Sign out/in; check `supabase.auth.getUser()` |
| Recovery codes not generated | Service role key missing | Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel |
| RLS blocking superadmin@AAL2 | Migration 0019 not applied | Run `supabase db push` |
| Login blocked during Redis outage | Fail-closed behavior | Restore Upstash or temporarily set `failOpen: true` for login |
| `MFA_REQUIRED` error in API | Double enforcement working | Ensure caller has AAL2 session |

---

## Contacts

- **Primary**: Platform Engineering
- **Supabase**: Project Dashboard > Auth > MFA
- **Upstash**: Console > Redis > Metrics
- **Vercel**: Project > Settings > Environment Variables