import { describe, expect, it } from "vitest";
import type { Metadata } from "next";
import { findBestFlavourMatch } from "./flavour-match";
import { buildPageMetadata, buildShareMetadata } from "./og";

// Next's OpenGraph type is a discriminated union that TS can't index loosely —
// narrow it once here so the assertions stay readable.
function og(m: Metadata) {
  return m.openGraph as
    | { images?: { url?: string }[]; type?: string; title?: string; description?: string }
    | undefined;
}

const base = {
  slug: "banana-loaf",
  name: "Banana loaf",
  description: "Moist banana loaf",
  price: 450,
  image_url: "/showcase/banana-loaf.jpg",
};

describe("findBestFlavourMatch", () => {
  it("matches product names to a flavour by shared words", () => {
    const id = findBestFlavourMatch("Classic Black Forest", [
      { id: "vanilla", name: "Vanilla" },
      { id: "black-forest", name: "Black Forest" },
    ]);
    expect(id).toBe("black-forest");
  });

  it("returns null when no flavour name is similar", () => {
    const id = findBestFlavourMatch("Lemon drizzle", [
      { id: "vanilla", name: "Vanilla" },
      { id: "red-velvet", name: "Red Velvet" },
    ]);
    expect(id).toBeNull();
  });
});

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
  it("sets a canonical URL for the share page", () => {
    const m = buildShareMetadata(base, "https://tamera.example");
    expect(m.alternates?.canonical).toBeInstanceOf(URL);
    expect(String(m.alternates?.canonical)).toBe("https://tamera.example/p/banana-loaf");
  });
});

describe("buildPageMetadata", () => {
  const page = {
    title: "Fresh cakes in Kitengela",
    description: "Order cakes and pastries on WhatsApp.",
    siteUrl: "https://tamera.example",
  };

  it("sets title and description", () => {
    const m = buildPageMetadata(page);
    expect(m.title).toBe(page.title);
    expect(m.description).toBe(page.description);
  });

  it("sets openGraph with type website", () => {
    const m = buildPageMetadata(page);
    expect(og(m)?.type).toBe("website");
    expect(og(m)?.title).toBe(page.title);
  });

  it("sets twitter card metadata", () => {
    const m = buildPageMetadata(page);
    const tw = m.twitter as { card?: string; title?: string } | undefined;
    expect(tw?.card).toBe("summary");
    expect(tw?.title).toBe(page.title);
  });

  it("resolves an absolute og:image against siteUrl", () => {
    const m = buildPageMetadata({ ...page, image: "/showcase/hero.jpg" });
    expect(og(m)?.images?.[0]?.url).toBe("https://tamera.example/showcase/hero.jpg");
    const tw = m.twitter as { images?: { url?: string }[] } | undefined;
    expect(tw?.images?.[0]?.url).toBe("https://tamera.example/showcase/hero.jpg");
  });

  it("omits images when none given", () => {
    const m = buildPageMetadata(page);
    expect(og(m)?.images ?? []).toHaveLength(0);
    const tw = m.twitter as { images?: unknown[] } | undefined;
    expect(tw?.images ?? []).toHaveLength(0);
  });

  it("sets a canonical URL when path is provided", () => {
    const m = buildPageMetadata({ ...page, path: "/cakes" });
    expect(m.alternates?.canonical).toBeInstanceOf(URL);
    expect(String(m.alternates?.canonical)).toBe("https://tamera.example/cakes");
  });

  it("omits canonical when no path", () => {
    const m = buildPageMetadata(page);
    expect(m.alternates?.canonical).toBeUndefined();
  });
});
