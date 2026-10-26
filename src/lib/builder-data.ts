"use cache";

import { cacheLife, cacheTag } from "next/cache";
import { getPublicClient } from "./supabase/public";

export type CakeSize = { id: string; kg: number };
export type DesignTier = {
  id: string;
  name: string;
  extra_fee: number;
  requires_quote: boolean;
  description: string | null;
};
export type DeliveryZone = { id: string; name: string; fee: number };

export async function getSizes(): Promise<CakeSize[]> {
  cacheTag("catalog");
  cacheLife("hours");
  const { data, error } = await getPublicClient()
    .from("cake_sizes")
    .select("id,kg,sort_order")
    .eq("available", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`getSizes: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, kg: Number(row.kg) }));
}

export async function getDesignTiers(): Promise<DesignTier[]> {
  cacheTag("catalog");
  cacheLife("hours");
  const { data, error } = await getPublicClient()
    .from("design_tiers")
    .select("id,name,extra_fee,requires_quote,description,sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`getDesignTiers: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    extra_fee: row.extra_fee,
    requires_quote: row.requires_quote,
    description: row.description,
  }));
}

export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  cacheTag("catalog");
  cacheLife("hours");
  // `delivery_zones` has no `sort_order` column (0002_tables.sql only adds it
  // to profiles, categories, products, cake_flavours and cake_sizes), so the
  // zones are ordered by name.
  const { data, error } = await getPublicClient()
    .from("delivery_zones")
    .select("id,name,fee")
    .eq("active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(`getDeliveryZones: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, fee: row.fee }));
}

export async function getBlockedDates(): Promise<string[]> {
  cacheTag("catalog");
  cacheLife("hours");
  const { data, error } = await getPublicClient()
    .from("blocked_dates")
    .select("date")
    .order("date", { ascending: true });
  if (error) throw new Error(`getBlockedDates: ${error.message}`);
  return (data ?? []).map((row) => row.date);
}

export interface OrderSettings {
  min_lead_days: number;
  daily_cake_limit: number;
  deposit_percent: number;
  deposit_threshold_kg: number;
}

export async function getOrderSettings(): Promise<OrderSettings> {
  cacheTag("catalog");
  cacheLife("hours");
  const { data, error } = await getPublicClient()
    .from("settings")
    .select("min_lead_days,daily_cake_limit,deposit_percent,deposit_threshold_kg")
    .single();
  if (error) throw new Error(`getOrderSettings: ${error.message}`);
  return data as OrderSettings;
}
