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

/** Daraja M-Pesa environment configuration. Server-only. */
export interface DarajaEnvConfig {
  environment: 'sandbox' | 'production';
  consumerKey: string;
  consumerSecret: string;
  businessShortCode: string;
  passkey: string;
  callbackUrl: string;
}

/**
 * Get Daraja configuration from environment variables.
 * Throws if required variables are missing in production mode.
 * In development, returns a partial config that will fail at call time with clear errors.
 */
export function getDarajaConfig(): DarajaEnvConfig {
  const environment = (process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production') ?? 'sandbox';

  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const businessShortCode = process.env.MPESA_BUSINESS_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;

  const missing: string[] = [];
  if (!consumerKey) missing.push('MPESA_CONSUMER_KEY');
  if (!consumerSecret) missing.push('MPESA_CONSUMER_SECRET');
  if (!businessShortCode) missing.push('MPESA_BUSINESS_SHORTCODE');
  if (!passkey) missing.push('MPESA_PASSKEY');
  if (!callbackUrl) missing.push('MPESA_CALLBACK_URL');

  if (missing.length > 0) {
    const msg = `Missing Daraja environment variables: ${missing.join(', ')}. ` +
      'Add them to .env.local or deployment environment. ' +
      'Sandbox credentials can be obtained from https://developer.safaricom.co.ke/';
    if (environment === 'production') {
      throw new Error(msg);
    }
    // In development, warn but allow partial config (will fail at call time)
    console.warn('[Daraja] ' + msg);
  }

  return {
    environment,
    consumerKey: consumerKey ?? '',
    consumerSecret: consumerSecret ?? '',
    businessShortCode: businessShortCode ?? '',
    passkey: passkey ?? '',
    callbackUrl: callbackUrl ?? '',
  };
}

/**
 * Check if Daraja is fully configured (all required env vars present).
 *
 * Reads the environment directly — no warning, no throw — so it is safe to
 * call on every request to decide whether online payment is offered at all.
 */
export function isDarajaConfigured(): boolean {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY &&
      process.env.MPESA_CONSUMER_SECRET &&
      process.env.MPESA_BUSINESS_SHORTCODE &&
      process.env.MPESA_PASSKEY &&
      process.env.MPESA_CALLBACK_URL,
  );
}
