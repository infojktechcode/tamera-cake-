import type { SupabaseClient } from "@supabase/supabase-js";

import { countCakesForDate, countCakesForOrder } from "./cake-load";
import { checkDateNeeded } from "./rules";

/**
 * The date rules, checked against the live database.
 *
 * The order route checks them when the customer places the order. The shop
 * checks them again when it confirms the order (spec §5) — a day can be
 * blocked or filled up between the two moments.
 */

export interface DateRuleOptions {
  /** YYYY-MM-DD */
  dateNeeded: string;
  now?: Date;
  /**
   * The order being checked is left out of the capacity count, so the shop can
   * confirm an order without counting it against itself.
   */
  excludeOrderId?: string;
}

export async function checkOrderDateRules(
  supabase: SupabaseClient,
  options: DateRuleOptions,
): Promise<{ ok: boolean; reason?: string }> {
  const now = options.now ?? new Date();

  const [settingsRes, blockedRes] = await Promise.all([
    supabase
      .from("settings")
      .select("min_lead_days, daily_cake_limit")
      .eq("id", 1)
      .maybeSingle(),
    supabase.from("blocked_dates").select("date"),
  ]);

  if (settingsRes.error) {
    throw new Error(`checkOrderDateRules/settings: ${settingsRes.error.message}`);
  }
  if (blockedRes.error) {
    throw new Error(`checkOrderDateRules/blocked_dates: ${blockedRes.error.message}`);
  }

  const minLeadDays = (settingsRes.data?.min_lead_days as number | undefined) ?? 2;
  const dailyLimit = (settingsRes.data?.daily_cake_limit as number | undefined) ?? 5;

  const [booked, ownCakes] = await Promise.all([
    countCakesForDate(supabase, options.dateNeeded, {
      excludeOrderId: options.excludeOrderId,
    }),
    options.excludeOrderId
      ? countCakesForOrder(supabase, options.excludeOrderId)
      : Promise.resolve(0),
  ]);

  return checkDateNeeded({
    needed: options.dateNeeded,
    now,
    minLeadDays,
    blocked: new Set((blockedRes.data ?? []).map((b) => b.date as string)),
    // The order being checked still takes its own slots.
    confirmedCountOnDate: booked + ownCakes,
    dailyLimit,
  });
}
