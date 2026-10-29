/**
 * Pure helpers that turn raw `settings` rows into display-ready public
 * content: opening hours (UI + JSON-LD), FAQ, social links, policy links.
 *
 * Every helper degrades gracefully — a missing or malformed value falls back
 * to the shop's existing hardcoded defaults so a public page never crashes
 * or goes blank because a settings row is empty.
 */

import type { FaqItem } from "./settings-schema";

type Hours = Record<string, { open: string; close: string }>;

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};
const SCHEMA_ORG_DAYS: Record<(typeof DAY_KEYS)[number], string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** The shop's current hardcoded display string, used when settings are empty. */
export const DEFAULT_HOURS_DISPLAY = "Mon–Sun: 8:00am–8:00pm";
/** The shop's current hardcoded JSON-LD string, used when settings are empty. */
export const DEFAULT_HOURS_JSON_LD = "Mo-Su 08:00-20:00";

/** The four FAQ entries the home page shipped with — fallback when none are set. */
export const DEFAULT_FAQ: FaqItem[] = [
  {
    question: "How much is the deposit?",
    answer: "The deposit is set in the bakery settings and confirms the order before baking begins.",
  },
  {
    question: "Can I change my order?",
    answer:
      "Changes are welcome when we have not started baking. Contact us on WhatsApp as early as possible.",
  },
  {
    question: "Do you handle allergens?",
    answer:
      "We bake in a kitchen that handles common allergens. Please tell us about allergies when you order.",
  },
  {
    question: "How much notice do you need?",
    answer:
      "We recommend confirming your date at least a few days in advance. Custom cakes are booked based on the bakery calendar.",
  },
];

/** "08:00" → "8:00am". Unparseable input is returned untouched. */
function formatTime12(time: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return time;
  const hour = Number(m[1]);
  if (hour > 23) return time;
  const suffix = hour >= 12 ? "pm" : "am";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m[2]}${suffix}`;
}

function validDayEntries(hours: Hours) {
  return DAY_KEYS.flatMap((key) => {
    const entry = hours?.[key];
    if (!entry || typeof entry !== "object") return [];
    if (typeof entry.open !== "string" || typeof entry.close !== "string") return [];
    if (!entry.open || !entry.close) return [];
    return [{ key, open: entry.open, close: entry.close }];
  });
}

/**
 * Human-readable hours, e.g. "Mon–Sun: 8:00am–8:00pm". Consecutive days with
 * identical hours are collapsed into one range; gaps start a new group.
 * Empty/malformed input falls back to `DEFAULT_HOURS_DISPLAY`.
 */
export function formatOpeningHours(hours: Hours): string {
  const entries = validDayEntries(hours);
  if (entries.length === 0) return DEFAULT_HOURS_DISPLAY;

  const groups: { start: number; end: number; open: string; close: string }[] = [];
  for (const entry of entries) {
    const index = DAY_KEYS.indexOf(entry.key);
    const last = groups[groups.length - 1];
    const consecutive = last && last.end === index - 1;
    if (last && consecutive && last.open === entry.open && last.close === entry.close) {
      last.end = index;
    } else {
      groups.push({ start: index, end: index, open: entry.open, close: entry.close });
    }
  }

  return groups
    .map((group) => {
      const startLabel = DAY_LABELS[DAY_KEYS[group.start]];
      const endLabel = DAY_LABELS[DAY_KEYS[group.end]];
      const range = group.start === group.end ? startLabel : `${startLabel}–${endLabel}`;
      return `${range}: ${formatTime12(group.open)}–${formatTime12(group.close)}`;
    })
    .join(" · ");
}

/**
 * Schema.org `openingHoursSpecification` built from settings, or the legacy
 * `openingHours` string when hours are empty/malformed.
 */
export function buildOpeningHoursJsonLd(hours: Hours): Record<string, unknown> {
  const entries = validDayEntries(hours);
  if (entries.length === 0) return { openingHours: DEFAULT_HOURS_JSON_LD };
  return {
    openingHoursSpecification: entries.map((entry) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: SCHEMA_ORG_DAYS[entry.key],
      opens: entry.open,
      closes: entry.close,
    })),
  };
}

/** Settings FAQ when present; the shipped hardcoded set otherwise. */
export function resolveFaq(items: FaqItem[] | null | undefined): FaqItem[] {
  return items && items.length > 0 ? items : DEFAULT_FAQ;
}

export type SocialLink = { key: string; label: string; href: string };

const SOCIAL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
};

/** Known social networks with valid http(s) URLs; unknown/invalid entries dropped. */
export function resolveSocialLinks(links: Record<string, string> | null | undefined): SocialLink[] {
  if (!links) return [];
  return Object.entries(links).flatMap(([key, href]) => {
    const label = SOCIAL_LABELS[key];
    if (!label || typeof href !== "string") return [];
    if (!/^https?:\/\//i.test(href)) return [];
    return [{ key, label, href }];
  });
}

export type PolicyLink = { key: string; label: string; href: string };

const POLICY_FIELDS = [
  { key: "delivery", label: "Delivery policy", field: "delivery_policy" },
  { key: "payment", label: "Payment policy", field: "payment_policy" },
  { key: "cancellation", label: "Cancellation policy", field: "cancellation_policy" },
] as const;

/**
 * Policy links for policies that actually have text — empty policies are
 * hidden rather than rendered as dead links.
 */
export function resolvePolicyLinks(settings: {
  delivery_policy: string | null;
  payment_policy: string | null;
  cancellation_policy: string | null;
}): PolicyLink[] {
  return POLICY_FIELDS.filter((p) => (settings[p.field] ?? "").trim().length > 0).map((p) => ({
    key: p.key,
    label: p.label,
    href: `/policies/${p.key}`,
  }));
}
