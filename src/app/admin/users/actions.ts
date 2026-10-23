"use server";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabasePublishableKey } from "@/lib/supabase/env";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export async function getUsers() {
  const user = await requireUser();
  if (!can(user.role, "viewUsers")) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(getSupabaseUrl(), getSupabasePublishableKey());
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");

  return data || [];
}

export async function updateUserStatus(userId: string, active: boolean) {
  const user = await requireUser();
  if (!can(user.role, "viewUsers")) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(getSupabaseUrl(), getSupabasePublishableKey());
  const { error } = await supabase
    .from("profiles")
    .update({ active })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
  return { success: true };
}

export async function createManager(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "superadmin") {
    throw new Error("Only the owner can create managers.");
  }

  const email = formData.get("email") as string;
  const fullName = formData.get("fullName") as string;

  if (!email || !fullName) throw new Error("Email and Full Name are required.");

  const supabase = createClient(getSupabaseUrl(), getSupabasePublishableKey());

  // In a real Supabase setup, we'd use the Auth Admin API via the service key.
  // For this implementation, we assume the manager creates their own account
  // or the admin manually adds the profile after the user signs up.
  const { error } = await supabase
    .from("profiles")
    .insert({
      full_name: fullName,
      role: "manager",
      email: email, // Assuming profiles table has email or linked via auth.users
    });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
  return { success: true };
}
