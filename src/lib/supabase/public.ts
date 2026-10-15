import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

let client: SupabaseClient | null = null;

/**
 * Anonymous, cookie-less Supabase client for public (prerendered) pages.
 * Never touches cookies, so pages using it stay static. Publishable key only.
 */
export function getPublicClient(): SupabaseClient {
  if (!client) {
    client = createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
