import {
  can,
} from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabasePublishableKey } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";

export async function toggleDateBlock(date: string, reason: string) {
  "use server";
  const user = await requireUser();
  if (!can(user.role, "editSettings")) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(getSupabaseUrl(), getSupabasePublishableKey());

  // Use an upsert-like logic for blocked dates
  const { data, error } = await supabase
    .from("blocked_dates")
    .upsert({
      date,
      reason,
      created_at: new Date().toISOString()
    }, { onConflict: 'date' });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/calendar");
  return { success: true };
}

export async function unblockDate(date: string) {
  "use server";
  const user = await requireUser();
  if (!can(user.role, "editSettings")) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(getSupabaseUrl(), getSupabasePublishableKey());
  const { error } = await supabase
    .from("blocked_dates")
    .delete()
    .eq("date", date);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/calendar");
  return { success: true };
}
