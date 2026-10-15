import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Create a Supabase client bound to an incoming request, plus the response that
 * must be returned to the caller.
 *
 * Whenever the auth cookie is refreshed, the new value is written onto
 * `supabaseResponse` — so dropping that response loses the session.
 */
function createClient(request: NextRequest) {
  // Create an unmodified response
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  return { supabase, supabaseResponse };
}

/**
 * Refreshes the user's Supabase session on every matched request.
 *
 * Server Components can then read the session via `createClient(await cookies())`
 * without seeing a stale/expired cookie.
 */
export async function updateSession(request: NextRequest) {
  const { supabase, supabaseResponse } = createClient(request);

  // IMPORTANT: do not run code between createClient and getUser —
  // getUser() refreshes an expired session and its cookies land on supabaseResponse.
  await supabase.auth.getUser();

  return supabaseResponse;
}

/** Lower-level escape hatch when callers need the client itself (e.g. route guards). */
export { createClient };
