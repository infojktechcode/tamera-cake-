import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getServiceRoleKey, getSupabaseUrl } from "./env";

/**
 * SERVER-ONLY Supabase client with the service-role key.
 *
 * Bypasses Row Level Security — use only in admin scripts (e.g. provisioning
 * staff accounts) and server-side jobs that must write to protected tables.
 * Never import from a client component or expose to the browser.
 */
export function getSupabaseService() {
  return createServiceClient();
}

export function createServiceClient() {
  return createSupabaseClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
