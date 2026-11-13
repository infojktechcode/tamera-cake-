"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";
import type { Database } from "../database.types";

/**
 * Browser-side Supabase client.
 *
 * Uses the publishable (client-safe) key only — never the service-role key.
 * Call from client components; `cookies()` are handled automatically by
 * `@supabase/ssr`.
 */
export function createClient() {
  return createBrowserClient<Database>(getSupabaseUrl(), getSupabasePublishableKey());
}
