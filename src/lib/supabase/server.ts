import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 *
 * Takes the cookie store (from `await cookies()`) so the user's session is read
 * from — and written back to — the request cookies. Session refresh itself happens
 * in the proxy, which is why `setAll` here can safely ignore Server Component writes.
 */
export const createClient = async (
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) => {
  return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
};

export const createServerSupabaseClient = createClient;

// Legacy alias
export default createClient;
