import { describe, expect, it } from "vitest";
import type { Metadata } from "next";
import { buildShareMetadata } from "./og";

// Next's OpenGraph type is a discriminated union that TS can't index loosely —
// narrow it once here so the assertions stay readable.
function og(m: Metadata) {
  return m.openGraph as { images?: { url?: string }[]; type?: string } | undefined;
}

const base = {
  name: "Banana loaf",
  description: "Moist banana loaf",
  price: 450,
  image_url: "/showcase/banana-loaf.jpg",
};

describe("buildShareMetadata", () => {
  it("absolute og:image from siteUrl", () => {
    const m = buildShareMetadata(base, "http://localhost:3457");
    expect(og(m)?.images?.[0]?.url).toBe("http://localhost:3457/showcase/banana-loaf.jpg");
  });
  it("falls back when there is no image", () => {
    const m = buildShareMetadata({ ...base, image_url: null }, "http://localhost:3457");
    expect(m.openGraph?.images ?? []).toHaveLength(0);
  });
  it("uses product description", () => {
    const m = buildShareMetadata(base, "http://x");
    expect(m.description).toBe("Moist banana loaf");
    expect(m.openGraph?.description).toBe("Moist banana loaf");
  });
  it("falls back to shop blurb when description missing", () => {
    const m = buildShareMetadata({ ...base, description: null }, "http://x");
    expect(m.description).toBe("Order fresh from Tamera's Cakes & Bakery on WhatsApp.");
  });
  it("sets title and og type", () => {
    const m = buildShareMetadata(base, "http://x");
    expect(m.title).toBe("Banana loaf");
    expect(og(m)?.type).toBe("website");
  });
});
