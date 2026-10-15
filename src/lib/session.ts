import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import type { Role } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

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

  const supabase = await createClient(await cookies());

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) {
    redirect("/login");
  }

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile.full_name,
    role: profile.role as Role,
  };
};
