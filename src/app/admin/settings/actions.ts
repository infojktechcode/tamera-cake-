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
    whatsapp_number: z.string().trim().min(8).max(20).optional(),
    daily_cake_limit: z.coerce.number().int().min(1).max(100).optional(),
    deposit_percent: z.coerce.number().int().min(0).max(100).optional(),
    min_lead_days: z.coerce.number().int().min(0).max(90).optional(),
    sms_enabled: z.coerce.boolean().optional(),
    sms_provider: z.string().min(1).optional(),
    social_links: z.string().optional(),
    faq_items: z.string().optional(),
    delivery_policy: z.string().optional(),
    payment_policy: z.string().optional(),
    cancellation_policy: z.string().optional(),
    brand_colours: z.string().optional(),
    logo_url: z.string().optional(),
  }).safeParse({
    whatsapp_number: formData.get("whatsapp_number"),
    daily_cake_limit: formData.get("daily_cake_limit"),
    deposit_percent: formData.get("deposit_percent"),
    min_lead_days: formData.get("min_lead_days"),
    sms_enabled: formData.get("sms_enabled"),
    sms_provider: formData.get("sms_provider"),
    social_links: formData.get("social_links"),
    faq_items: formData.get("faq_items"),
    delivery_policy: formData.get("delivery_policy"),
    payment_policy: formData.get("payment_policy"),
    cancellation_policy: formData.get("cancellation_policy"),
    brand_colours: formData.get("brand_colours"),
    logo_url: formData.get("logo_url"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid shop settings.");
  }

  // Parse JSON string fields
  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined || value === null) continue;
    if (["social_links", "faq_items", "brand_colours"].includes(key)) {
      try {
        updateData[key] = JSON.parse(value as string);
      } catch {
        updateData[key] = value;
      }
    } else {
      updateData[key] = value;
    }
  }

  const supabase = await createClient(await cookies());
  const { error } = await supabase
    .from("settings")
    .update(updateData)
    .eq("id", 1);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { success: true };
}
