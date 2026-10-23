import {
  can,
} from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabasePublishableKey } from "@/lib/supabase/env";

export async function getCalendarData() {
  "use server";
  const user = await requireUser();

  const supabase = createClient(getSupabaseUrl(), getSupabasePublishableKey());

  // 1. Get blocked dates
  const { data: blocked } = await supabase
    .from("blocked_dates")
    .select("date, reason");

  // 2. Get all orders to count daily cakes
  const { data: orders } = await supabase
    .from("orders")
    .select("date_needed")
    .eq("status", "confirmed"); // Only count confirmed cakes

  // 3. Get shop settings for daily limit
  const { data: settings } = await supabase
    .from("settings")
    .select("daily_cake_limit")
    .single();

  return {
    blockedDates: blocked?.map(b => b.date) || [],
    dailyOrders: orders?.reduce((acc: Record<string, number>, curr) => {
      if (!curr.date_needed) return acc;
      acc[curr.date_needed] = (acc[curr.date_needed] || 0) + 1;
      return acc;
    }, {}),
    dailyLimit: settings?.daily_cake_limit || 6
  };
}
