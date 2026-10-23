"use server";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabasePublishableKey } from "@/lib/supabase/env";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export async function getSettings() {
  const user = await requireUser();
  const supabase = createClient(getSupabaseUrl(), getSupabasePublishableKey());
  const { data } = await supabase.from("settings").select("*").single();
  return data;
}

export async function updateSettings(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "editSettings")) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(getSupabaseUrl(), getSupabasePublishableKey());

  const updates = {
    whatsapp_number: formData.get("whatsapp_number"),
    daily_cake_limit: Number(formData.get("daily_cake_limit")),
    deposit_percent: Number(formData.get("deposit_percent")),
    min_lead_days: Number(formData.get("min_lead_days")),
  };

  const { error } = await supabase
    .from("settings")
    .update(updates)
    .eq("id", 1);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/settings");
  return { success: true };
}
