"use cache";

import { cacheLife, cacheTag } from "next/cache";

import { getPublicClient } from "./supabase/public";

export interface MessageTemplates {
  order_to_shop: string;
  thank_you: string;
  deposit_request: string;
  ready_pickup: string;
  out_for_delivery: string;
  product_update: string;
}

/** Fallback matching the seed's `order_to_shop` template. */
export const DEFAULT_ORDER_TO_SHOP =
  "Hi Tamera! Here is my order {order}\nName: {name}\nTotal: {total}\nDate needed: {date}";

/**
 * The shop's WhatsApp message templates, edited from the admin settings screen.
 * Cached with the rest of the catalogue.
 */
export async function getMessageTemplates(): Promise<MessageTemplates> {
  cacheTag("catalog");
  cacheLife("hours");
  const { data, error } = await getPublicClient()
    .from("settings")
    .select("message_templates")
    .eq("id", 1)
    .single();
  if (error) throw new Error(`getMessageTemplates: ${error.message}`);
  const templates = (data?.message_templates ?? {}) as Partial<MessageTemplates>;
  return {
    order_to_shop: templates.order_to_shop ?? DEFAULT_ORDER_TO_SHOP,
    thank_you: templates.thank_you ?? "",
    deposit_request: templates.deposit_request ?? "",
    ready_pickup: templates.ready_pickup ?? "",
    out_for_delivery: templates.out_for_delivery ?? "",
    product_update: templates.product_update ?? "",
  };
}
