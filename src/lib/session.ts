import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Role } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

/** The staff member and a Supabase client scoped to their session. */
export interface StaffSession {
  user: SessionUser;
  /**
   * A client that carries the staff member's session, so every read and
   * write goes through Row Level Security as *them* — not as the service
   * role, which would bypass it.
   */
  supabase: SupabaseClient;
}

async function loadProfile(supabase: SupabaseClient, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, active")
    .eq("id", userId)
    .single();

  if (!profile || !profile.active) return null;

  return {
    id: userId,
    email: "",
    fullName: profile.full_name,
    role: profile.role as Role,
  } satisfies SessionUser;
}

/**
 * The signed-in staff member and a client scoped to their session.
 *
 * Two ways in:
 *   - the session cookie, which is what the dashboard uses;
 *   - an `Authorization: Bearer <token>` header, for scripts and API clients.
 *
 * Returns null when nobody is signed in.
 */
export const getStaffSession = async (
  request?: Request,
): Promise<StaffSession | null> => {
  // --- the cookie (the dashboard) ---
  const cookieClient = await createClient(await cookies());
  const {
    data: { user: cookieUser },
  } = await cookieClient.auth.getUser();

  if (cookieUser) {
    const user = await loadProfile(cookieClient, cookieUser.id);
    if (!user) return null;
    return {
      user: { ...user, email: cookieUser.email ?? "" },
      supabase: cookieClient,
    };
  }

  // --- a bearer token (scripts, API clients) ---
  const header = request?.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;

  const token = header.slice(7).trim();
  if (!token) return null;

  // Validate the token with an auth-capable client...
  const authProbe = createSupabaseClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user: tokenUser },
  } = await authProbe.auth.getUser(token);
  if (!tokenUser) return null;

  // ...and then use it as the access token, so every query runs under that
  // staff member's Row Level Security policies.
  const scoped = createSupabaseClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    accessToken: async () => token,
  });

  const user = await loadProfile(scoped, tokenUser.id);
  if (!user) return null;

  return { user: { ...user, email: tokenUser.email ?? "" }, supabase: scoped };
};

/**
 * The signed-in staff member, or null.
 *
 * Used by route handlers, where a missing session must be a 401 rather than
 * a redirect to the login page.
 */
export const getUser = async (request?: Request): Promise<SessionUser | null> => {
  const session = await getStaffSession(request);
  return session?.user ?? null;
};

/**
 * Resolve the signed-in staff member (user + profile) in a Server Component.
 *
 * - Not signed in → redirect to /login.
 * - Signed in but no profile row, or inactive → sign out is handled by the
 *   caller's proxy; we redirect to /login so a broken account never renders
 *   the admin shell.
 */
export const requireUser = async (): Promise<SessionUser> => {
  // Everything below reads the session cookie and Supabase's session handling
  // calls Date.now() — an unstable value during prerendering. Stop prerender
  // here so every admin route renders at request time.
  await connection();

  const session = await getStaffSession();
  if (!session) {
    redirect("/login");
  }

  return session.user;
};
