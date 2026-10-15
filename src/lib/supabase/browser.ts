"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Browser-side Supabase client.
 *
 * Uses the publishable (client-safe) key only — never the service-role key.
 * Call from client components; `cookies()` are handled automatically by
 * `@supabase/ssr`.
 */
export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey());
}
