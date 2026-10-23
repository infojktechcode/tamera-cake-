"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import type { Role } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { SessionUser } from "./session-types";

/**
 * Resolve the signed-in staff member (user + profile) in a Server Component.
 */
export const requireUser = async (): Promise<SessionUser> => {
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
