import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";
import type { Database } from "../database.types";

let client: SupabaseClient<Database> | null = null;

/**
 * Anonymous, cookie-less Supabase client for public (prerendered) pages.
 * Never touches cookies, so pages using it stay static. Publishable key only.
 */
export function getPublicClient(): SupabaseClient<Database> {
  if (!client) {
    client = createClient<Database>(getSupabaseUrl(), getSupabasePublishableKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
