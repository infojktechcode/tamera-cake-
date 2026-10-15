// Pure, testable date/capacity/blocked-date rules (Africa/Nairobi).
export interface DateRuleInput {
  needed: string; // YYYY-MM-DD
  now: Date;
  minLeadDays: number;
  blocked: Set<string>;
  confirmedCountOnDate: number;
  dailyLimit: number;
}

export type DateCheck = { ok: boolean; reason?: string };

export function checkDateNeeded(input: DateRuleInput): DateCheck {
  const nowNairobi = new Date(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(input.now),
  );
  const needed = new Date(input.needed);
  const diffDays = Math.round((needed.getTime() - nowNairobi.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < input.minLeadDays) {
    return { ok: false, reason: `Please allow at least ${input.minLeadDays} days lead time.` };
  }
  if (input.blocked.has(input.needed)) {
    return { ok: false, reason: "That day is closed. Please pick another date." };
  }
  if (input.confirmedCountOnDate >= input.dailyLimit) {
    return { ok: false, reason: "That day is fully booked. Please pick another date." };
  }
  return { ok: true };
}
