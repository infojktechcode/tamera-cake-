import { describe, it, expect } from "vitest";
import {
  DEFAULT_FAQ,
  DEFAULT_HOURS_DISPLAY,
  buildOpeningHoursJsonLd,
  formatOpeningHours,
  resolveFaq,
  resolvePolicyLinks,
  resolveSocialLinks,
} from "./public-content";

const FULL_WEEK = {
  mon: { open: "08:00", close: "20:00" },
  tue: { open: "08:00", close: "20:00" },
  wed: { open: "08:00", close: "20:00" },
  thu: { open: "08:00", close: "20:00" },
  fri: { open: "08:00", close: "20:00" },
  sat: { open: "08:00", close: "20:00" },
  sun: { open: "08:00", close: "20:00" },
};

describe("formatOpeningHours", () => {
  it("collapses a full week with identical hours into one range", () => {
    expect(formatOpeningHours(FULL_WEEK)).toBe("Mon–Sun: 8:00am–8:00pm");
  });

  it("falls back to the default display when hours are empty", () => {
    expect(formatOpeningHours({})).toBe(DEFAULT_HOURS_DISPLAY);
    expect(DEFAULT_HOURS_DISPLAY).toBe("Mon–Sun: 8:00am–8:00pm");
  });

  it("groups days with different hours separately", () => {
    const hours = {
      mon: { open: "09:00", close: "18:00" },
      tue: { open: "09:00", close: "18:00" },
      sat: { open: "10:00", close: "16:00" },
    };
    const display = formatOpeningHours(hours);
    expect(display).toContain("Mon–Tue: 9:00am–6:00pm");
    expect(display).toContain("Sat: 10:00am–4:00pm");
    expect(display).toContain(" · "); // separate groups
  });

  it("ignores malformed day entries", () => {
    const hours = {
      mon: "08:00-20:00", // wrong shape — schema allows any record value shape at runtime
      tue: { open: "", close: "" },
      wed: { open: "08:00", close: "20:00" },
    } as never;
    expect(formatOpeningHours(hours)).toBe("Wed: 8:00am–8:00pm");
  });
});

describe("buildOpeningHoursJsonLd", () => {
  it("builds an openingHoursSpecification from settings hours", () => {
    const jsonLd = buildOpeningHoursJsonLd(FULL_WEEK) as {
      openingHoursSpecification?: { dayOfWeek: string; opens: string; closes: string }[];
      openingHours?: string;
    };
    expect(jsonLd.openingHours).toBeUndefined();
    expect(jsonLd.openingHoursSpecification).toHaveLength(7);
    expect(jsonLd.openingHoursSpecification?.[0]).toEqual({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Monday",
      opens: "08:00",
      closes: "20:00",
    });
  });

  it("falls back to the hardcoded Mo-Su string when hours are empty", () => {
    const jsonLd = buildOpeningHoursJsonLd({}) as {
      openingHours?: string;
      openingHoursSpecification?: unknown;
    };
    expect(jsonLd.openingHours).toBe("Mo-Su 08:00-20:00");
    expect(jsonLd.openingHoursSpecification).toBeUndefined();
  });
});

describe("resolveFaq", () => {
  it("uses settings faq_items when present", () => {
    const items = [{ question: "Q?", answer: "A." }];
    expect(resolveFaq(items)).toBe(items);
  });

  it("falls back to the hardcoded FAQ when the array is empty", () => {
    expect(resolveFaq([])).toEqual(DEFAULT_FAQ);
    expect(DEFAULT_FAQ.length).toBeGreaterThan(0);
    for (const item of DEFAULT_FAQ) {
      expect(item.question.length).toBeGreaterThan(0);
      expect(item.answer.length).toBeGreaterThan(0);
    }
  });
});

describe("resolveSocialLinks", () => {
  it("returns labelled links for known networks", () => {
    const links = resolveSocialLinks({
      facebook: "https://facebook.com/tameras",
      instagram: "https://instagram.com/tameras",
    });
    expect(links).toEqual([
      { key: "facebook", label: "Facebook", href: "https://facebook.com/tameras" },
      { key: "instagram", label: "Instagram", href: "https://instagram.com/tameras" },
    ]);
  });

  it("returns nothing when social links are empty", () => {
    expect(resolveSocialLinks({})).toEqual([]);
  });

  it("drops non-http(s) values", () => {
    expect(resolveSocialLinks({ facebook: "javascript:alert(1)" } as never)).toEqual([]);
  });
});

describe("resolvePolicyLinks", () => {
  const base = {
    delivery_policy: "We deliver within Kitengela.",
    payment_policy: null,
    cancellation_policy: "   ",
  };

  it("only includes policies with non-empty text", () => {
    expect(resolvePolicyLinks(base)).toEqual([
      { key: "delivery", label: "Delivery policy", href: "/policies/delivery" },
    ]);
  });

  it("returns nothing when all policies are empty", () => {
    expect(
      resolvePolicyLinks({ delivery_policy: null, payment_policy: null, cancellation_policy: null }),
    ).toEqual([]);
  });
});
