# Bakery setup checklist

Use this file when spinning up a new bakery instance from the Tamera's Cakes & Bakery codebase.

## 1. Fill in the site-specific values

Set these in `.env.local` or the deployment environment before starting the app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SECRET_KEY` (or the legacy `SUPABASE_SERVICE_ROLE_KEY`)
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SHOP_WHATSAPP`
- `SEED_SUPERADMIN_EMAIL`
- `SEED_SUPERADMIN_PASSWORD`
- `SEED_MANAGER_EMAIL`
- `SEED_MANAGER_PASSWORD`

Never commit the real values. Keep them in the deployment environment.

## 2. Create or restore the bakery data

1. Create the Supabase project.
2. Apply the migrations in `supabase/migrations/` in order.
3. Run `supabase/seed.sql` to load the bakery catalogue and starter settings.
4. Update the shop info, opening hours, contact details, flavours, prices and delivery zones in the admin screen.

## 3. Configure the public-facing storefront

Update the business details in the admin settings or the database so the public site reflects the correct:

- shop name
- WhatsApp number
- address and delivery areas
- opening hours
- deposit rules and lead-time settings
- prices and custom cake flavours

## 4. Deploy without code edits

The app is designed to be reused by changing the environment and database values rather than editing the source code. A new bakery deploy is therefore a separate deployment plus a separate Supabase project or complete schema clone, not a forked source-code change.

## 5. Optional provider integration

The current checkout flow uses the app's order system and server-side validation. If you want live Daraja M-Pesa payments or automated notifications, add the provider credentials in the deployment environment and wire the corresponding endpoints without changing the core storefront code paths.
