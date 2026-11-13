import { type NextRequest, NextResponse } from "next/server";

import { isAdminPathAllowed } from "./lib/permissions";
import { createClient } from "./lib/supabase/middleware";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`. This runs on every matched
 * request and keeps the Supabase auth cookie fresh, which is what lets Server
 * Components read the session with `supabase.auth.getUser()`.
 *
 * It also enforces the route guards for the admin shell:
 *   - `/admin/*` while signed out  → redirect to `/login`
 *   - `/login` while signed in     → redirect to `/admin`
 *   - superadmin-only paths as a manager → redirect to `/admin`
 *   - superadmin without AAL2 (MFA) → redirect to MFA challenge
 * The layout re-checks the user's profile (active + role) on every render, so
 * hiding is never the only control.
 *
 * AAL2 enforcement is gated by NEXT_PUBLIC_ENFORCE_MFA (default: false).
 * Rollout: staging first → enroll two factors → enable flag → production.
 */
export async function proxy(request: NextRequest) {
  const { supabase, supabaseResponse } = createClient(request);

  // IMPORTANT: do not run code between createClient() and getUser().
  // getUser() refreshes an expired session cookie, and only the cookies set
  // during that call are copied onto supabaseResponse.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isLogin = pathname === "/login";

  // Feature flag: AAL2 enforcement for superadmin (default off for safe rollout)
  const enforceMfa = process.env.NEXT_PUBLIC_ENFORCE_MFA === "true";

  // Signed out and heading into the admin area → login screen.
  if (isAdmin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Signed in and on the login screen → admin overview.
  if (isLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // ---- CENTRAL AAL2 ENFORCEMENT FOR SUPERADMIN (behind feature flag) ----
  // If the user is a superadmin, they MUST have AAL2 (MFA verified) to access
  // any protected route except the MFA enrollment/challenge pages and auth APIs.
  if (enforceMfa && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "superadmin") {
      const aal = user.app_metadata?.aal || user.user_metadata?.aal;
      const isMfaRoute = pathname.startsWith("/admin/security/mfa");
      const isLoginRoute = pathname === "/login";
      const isApiAuthRoute = pathname.startsWith("/api/auth");

      if (aal !== "aal2" && !isMfaRoute && !isLoginRoute && !isApiAuthRoute) {
        // Redirect to MFA challenge (Server Component will render challenge UI)
        const url = request.nextUrl.clone();
        url.pathname = "/admin/security/mfa/challenge";
        url.searchParams.set("redirectTo", pathname);
        return NextResponse.redirect(url);
      }
    }
  }

  // Signed-in staff on a role-restricted path → back to the overview.
  // The profile lookup is cheap and only runs for admin paths; if the profile
  // is missing we let the layout's requireUser() deal with it.
  if (isAdmin && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .single();

    if (profile && !profile.active) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (profile && !isAdminPathAllowed(profile.role, pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  // Run on everything except static assets and public API routes that MUST remain
  // accessible without authentication (M-Pesa callbacks, order intake).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.png$|.*\\.jpg$|.*\\.svg$|api/orders|api/mpesa/callback|api/mpesa/retry|api/mpesa/status).*)",
  ],
};
