"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function getUsers() {
  const user = await requireUser();
  if (!can(user.role, "viewUsers")) {
    throw new Error("Unauthorized");
  }

  const supabase = await createClient(await cookies());
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .order("full_name");

  if (error) throw new Error(`Could not load staff accounts: ${error.message}`);
  return data;
}

export async function updateUserStatus(userId: string, active: boolean) {
  const user = await requireUser();
  if (!can(user.role, "viewUsers")) {
    throw new Error("Unauthorized");
  }

  const parsedId = z.uuid().safeParse(userId);
  if (!parsedId.success || typeof active !== "boolean") {
    throw new Error("Invalid staff account update.");
  }
  if (userId === user.id && !active) {
    throw new Error("You cannot deactivate your own account.");
  }

  const supabase = await createClient(await cookies());
  const { error } = await supabase
    .from("profiles")
    .update({ active })
    .eq("id", parsedId.data);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
  return { success: true };
}

export async function createManager(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "superadmin") {
    throw new Error("Only the owner can create managers.");
  }

  const parsed = z.object({
    email: z.string().trim().email().max(254),
    fullName: z.string().trim().min(1).max(120),
  }).safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Enter a valid name and email.");
  }

  const service = createServiceClient();
  const { data: invitation, error: inviteError } = await service.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { data: { full_name: parsed.data.fullName } },
  );
  if (inviteError) throw new Error(`Could not invite manager: ${inviteError.message}`);
  if (!invitation.user) throw new Error("The manager invitation did not return a user.");

  const { error: profileError } = await service
    .from("profiles")
    .insert({
      id: invitation.user.id,
      full_name: parsed.data.fullName,
      role: "manager",
      active: true,
    });

  if (profileError) {
    const { error: cleanupError } = await service.auth.admin.deleteUser(invitation.user.id);
    if (cleanupError) {
      console.error(`Could not clean up invited user ${invitation.user.id}: ${cleanupError.message}`);
    }
    throw new Error(`Could not create manager profile: ${profileError.message}`);
  }

  revalidatePath("/admin/users");
  return { success: true };
}
