"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export async function getSettings() {
  await requireUser();
  const supabase = await createClient(await cookies());
  const { data, error } = await supabase.from("settings").select("*").single();
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  if (!data) throw new Error("Shop settings have not been configured.");
  return data;
}

/**
 * `FormData.get()` yields `null` for a field the form never submitted, but
 * Zod's `.optional()` accepts only `undefined`. Handing it `null` fails
 * validation and aborts the entire save, so absent fields are normalised
 * here to mean "not provided — leave the stored value alone".
 */
function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

/**
 * Numeric inputs only: `z.coerce.number()` turns `""` into `0`, which would
 * quietly store a zero the operator never typed (reachable for
 * `deposit_percent` / `min_lead_days`, whose minimum is 0). An empty input
 * means "not provided", same as a missing one.
 */
function numberField(formData: FormData, name: string): string | undefined {
  const value = field(formData, name);
  return value === "" ? undefined : value;
}

/**
 * HTML checkboxes are omitted from the submission when unchecked, so an
 * absent name must mean "leave the stored flag alone" — not `false`.
 * `z.coerce.boolean()` got this wrong twice over: `null` coerced to `false`
 * (disabling SMS on every save) and the literal `"off"` coerced to `true`
 * (making SMS impossible to switch off at all).
 *
 * When the name *is* present the last value wins, so the recommended
 * hidden `value="off"` + checkbox `value="on"` pair reports the real
 * checked state either way.
 */
function checkboxField(formData: FormData, name: string): boolean | undefined {
  const values = formData.getAll(name);
  const last = values[values.length - 1];
  if (typeof last !== "string") return undefined;
  return last !== "off" && last !== "false" && last !== "0" && last !== "";
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
    sms_enabled: z.boolean().optional(),
    sms_provider: z.string().min(1).optional(),
    message_templates: z.string().optional(),
    social_links: z.string().optional(),
    faq_items: z.string().optional(),
    delivery_policy: z.string().optional(),
    payment_policy: z.string().optional(),
    cancellation_policy: z.string().optional(),
    brand_colours: z.string().optional(),
    logo_url: z.string().optional(),
  }).safeParse({
    whatsapp_number: field(formData, "whatsapp_number"),
    daily_cake_limit: numberField(formData, "daily_cake_limit"),
    deposit_percent: numberField(formData, "deposit_percent"),
    min_lead_days: numberField(formData, "min_lead_days"),
    sms_enabled: checkboxField(formData, "sms_enabled"),
    sms_provider: field(formData, "sms_provider"),
    message_templates: field(formData, "message_templates"),
    social_links: field(formData, "social_links"),
    faq_items: field(formData, "faq_items"),
    delivery_policy: field(formData, "delivery_policy"),
    payment_policy: field(formData, "payment_policy"),
    cancellation_policy: field(formData, "cancellation_policy"),
    brand_colours: field(formData, "brand_colours"),
    logo_url: field(formData, "logo_url"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid shop settings.");
  }

  // Parse JSON string fields
  type SettingsUpdate = Database["public"]["Tables"]["settings"]["Update"];

  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined || value === null) continue;
    if (["social_links", "faq_items", "brand_colours", "message_templates"].includes(key)) {
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
    .update(updateData as SettingsUpdate)
    .eq("id", 1);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { success: true };
}
