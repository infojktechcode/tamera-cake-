# Remediation Plan — Tamera's Cakes & Bakery Order System

**Based on:** AUDIT.md (2026-10-27)
**Total phases:** 4 (Phase 1 already complete)
**Approach:** Small, reviewable changes with verification after each step

---

## Overview of Work

| Phase | Area | Status | Priority |
|-------|------|--------|----------|
| Phase 1 | M-Pesa Deposit | ✅ ALREADY IMPLEMENTED | — |
| Phase 4 | Customer Notifications | ⏳ PENDING | P1 |
| Phase 6 | Public Content & SEO | ⏳ PENDING | P2 |
| Phase 7 | Resellable Configuration | ⏳ PENDING | P3 |

---

## Phase 4: Customer Notifications (P1)

### Scope

Build a provider-independent notification service that sends SMS/WhatsApp messages on key order events.

**Initial provider:** Africa's Talking SMS (per mission requirement). Design must be extensible to WhatsApp Cloud API later.

### Deliverables

| Item | Description | Files |
|------|-------------|-------|
| Notification service interface | `sendSms(to, message)`, `sendTemplate(to, template, vars)` | `src/lib/notifications/service.ts` |
| Africa's Talking provider | HTTP client for Africa's Talking SMS API | `src/lib/notifications/providers/africastalking.ts` |
| Mock provider | Records calls for tests without sending real SMS | `src/lib/notifications/providers/mock.ts` |
| Outbox table + function | Reliable delivery pattern: `notifications_outbox` table + trigger | Migration `0012_notifications.sql` |
| Status-change triggers | Send SMS on order status transitions | `src/lib/notifications/triggers.ts` |
| Notification settings | `sms_enabled`, `sms_provider` in settings | Migration adds columns |
| Tests | Vitest tests for service, provider, triggers | `src/lib/notifications/*.test.ts` |

### Migration: `0012_notifications.sql`

1. Add `sms_enabled` (boolean, default false), `sms_provider` (text, default 'africas_talking') to `settings`
2. Create `notifications_outbox` table:
   - `id` (uuid, PK)
   - `order_id` (uuid, FK → orders)
   - `channel` (text: 'sms', 'whatsapp')
   - `template` (text)
   - `to_phone` (text)
   - `message` (text)
   - `status` (enum: 'pending', 'sent', 'failed', 'suppressed')
   - `attempts` (int, default 0)
   - `max_attempts` (int, default 3)
   - `created_at` (timestamptz)
   - `sent_at` (timestamptz, nullable)
   - `error_message` (text, nullable)
3. Create index on `(status, created_at)` for worker polling
4. RLS: service_role can insert/read/update; public/anon cannot access

### Triggers

On order status change:

| From → To | Notification | Template |
|-----------|-------------|----------|
| any → `pending_payment` | Deposit request SMS | `deposit_request` |
| `pending_payment` → `deposit_paid` | Deposit confirmed SMS | `thank_you` |
| any → `in_production` | Production started SMS | `order_to_shop` |
| any → `ready` | Ready for pickup/delivery SMS | `ready_pickup` |
| any → `out_for_delivery` | Out for delivery SMS | `out_for_delivery` |
| any → `completed` | Order completed SMS | `thank_you` |
| any → `cancelled` | Order cancelled SMS | `product_update` |

### Duplicate Prevention

- Idempotency key: hash of (order_id, status, channel)
- Check outbox for existing pending/sent notification before inserting
- Suppress duplicate sends within 24h for same (order_id, channel)

### Testing

- Valid status transitions trigger notification
- Duplicate events do not create duplicate outbox entries
- Provider error → outbox entry marked failed, retried
- Missing credentials → notification queued but not sent (no crash)
- Mock provider used in all tests — no real SMS

---

## Phase 6: Public Content & SEO (P2)

### Scope

Implement public-facing content improvements using existing product data.

### Deliverables

| Item | Description | Files |
|------|-------------|-------|
| Cake gallery page | `/cakes` listing all available cakes with images, prices, filters | `src/app/(public)/cakes/page.tsx` |
| OG/Twitter metadata | Open Graph + Twitter cards on all public pages | `src/app/(public)/page.tsx`, `/p/[slug]/page.tsx`, `/cakes/page.tsx` |
| Canonical URLs | `alternates.canonical` on product and gallery pages | Same as above |
| Social links | `social_links` JSONB in settings; render in footer/header | Migration + `SettingsForm` + layout |
| DB-driven opening hours | Use `settings.opening_hours` on home page JSON-LD + UI | `src/app/(public)/page.tsx` |
| Editable FAQ | FAQ content from settings; admin-editable | Migration + settings form |
| Editable policies | Delivery/payment/cancellation policies from settings | Migration + settings form |
| Tests | Vitest for gallery, OG metadata, FAQ rendering | `src/lib/notifications/*.test.ts` |

### Migration: `0013_public_content.sql`

1. Add `social_links` (jsonb, default '{}') to `settings`
2. Add `faq_items` (jsonb, default '[]') to `settings`
3. Add `delivery_policy` (text, nullable) to `settings`
4. Add `payment_policy` (text, nullable) to `settings`
5. Add `cancellation_policy` (text, nullable) to `settings`

### Social Links Schema

```json
{
  "whatsapp": "2547XXXXXXXX",
  "facebook": "https://facebook.com/tamerascakes",
  "instagram": "https://instagram.com/tamerascakes",
  "tiktok": "https://tiktok.com/@tamerascakes"
}
```

### Opening Hours

Use existing `settings.opening_hours` (Record<string, { open, close }>) already in DB. Update home page to use DB value instead of hardcoded `Mo-Su 08:00-20:00`.

---

## Phase 7: Resellable Configuration (P3)

### Scope

Centralize configurable business information in the settings table.

### Deliverables

| Item | Description | Files |
|------|-------------|-------|
| Brand colours | `brand_colours` JSONB in settings; CSS custom properties | Migration + `globals.css` + `SettingsForm` |
| Logo URL | `logo_url` in settings (Supabase Storage path) | Migration + `SettingsForm` + header |
| Social links | Already in Phase 6 — link here | — |
| SETUP.md expansion | Daraja sandbox, SMS provider, brand colours, social links | `SETUP.md` |

### Migration: `0014_resellable_config.sql`

1. Add `brand_colours` (jsonb, default '{}') to `settings`
2. Add `logo_url` (text, nullable) to `settings`

### Brand Colours Schema

```json
{
  "primary": "#cocoa",
  "secondary": "#strawberry",
  "accent": "#pistachio",
  "background": "#vanilla"
}
```

### SETUP.md Expansion

Add sections:
- Daraja sandbox configuration (MPESA_* env vars)
- SMS provider configuration (Africa's Talking API key)
- Brand colours setup (admin settings)
- Social links setup (admin settings)
- Logo upload (admin settings → Storage)

---

## Phase Order (Recommended)

1. **Phase 4** — Notifications (P1 — highest business value)
2. **Phase 6** — Public Content & SEO (P2 — customer acquisition)
3. **Phase 7** — Resellable Configuration (P3 — new client onboarding)

---

## Verification Checklist

After each phase:

- [ ] `pnpm test` passes (no regressions)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` passes (where environment permits)
- [ ] Git diff reviewed
- [ ] Security-sensitive changes audited
- [ ] No credentials exposed
- [ ] No real payments or customer messages triggered

---

## Blockers

| Item | Status | Notes |
|------|--------|-------|
| Africa's Talking API credentials | Not available | Implementation uses mock; credentials documented in SETUP.md |
| WhatsApp Cloud API approval | Not available | Deferred — design is extensible, not yet implemented |
| Production Supabase access | Not available | Migrations prepared; deployment instructions documented |