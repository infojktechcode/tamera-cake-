"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getSettings() {
  await requireUser();
  const supabase = await createClient(await cookies());
  const { data, error } = await supabase.from("settings").select("*").single();
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  if (!data) throw new Error("Shop settings have not been configured.");
  return data;
}

export async function updateSettings(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "editSettings")) {
    throw new Error("Unauthorized");
  }

  const parsed = z.object({
    whatsapp_number: z.string().trim().min(8).max(20),
    daily_cake_limit: z.coerce.number().int().min(1).max(100),
    deposit_percent: z.coerce.number().int().min(0).max(100),
    min_lead_days: z.coerce.number().int().min(0).max(90),
  }).safeParse({
    whatsapp_number: formData.get("whatsapp_number"),
    daily_cake_limit: formData.get("daily_cake_limit"),
    deposit_percent: formData.get("deposit_percent"),
    min_lead_days: formData.get("min_lead_days"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid shop settings.");
  }

  const supabase = await createClient(await cookies());
  const { error } = await supabase
    .from("settings")
    .update(parsed.data)
    .eq("id", 1);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/settings");
  return { success: true };
}
