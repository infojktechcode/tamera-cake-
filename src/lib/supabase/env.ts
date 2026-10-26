/**
 * Centralised Supabase environment access.
 *
 * Supports both current key naming conventions:
 *   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  (newer "sb_publishable_..." keys)
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY         (legacy JWT-style anon key)
 * One of them must be set; the publishable key wins if both are present.
 */

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Copy .env.example to .env.local and fill it in.",
    );
  }
  return url.replace(/\/$/, ""); // strip trailing slash
}

/** Publishable (client-safe) key used by browser and server clients. */
export function getSupabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY). See .env.example.",
    );
  }
  return key;
}

/**
 * Secret service-role key. Server-only — never imported by client components.
 * Throws when missing so misconfiguration fails loudly at call time.
 */
export function getServiceRoleKey(): string {
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY). This server-only key is required for checkout, confirmation lookups, signed photo uploads, activity logging, and staff provisioning.",
    );
  }
  return key;
}

/** Absolute site URL used for auth redirects (Vercel sets this in production). */
export function getSiteUrl(): string {
  const fromVercel = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : undefined;
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    fromVercel ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
