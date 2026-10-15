import { afterEach, describe, expect, it, vi } from "vitest";
import { getShopWhatsapp, waHref } from "./whatsapp";

describe("waHref", () => {
  it("builds a wa.me link with encoded text", () => {
    expect(waHref("254700000000", "Two cakes 🎂 & candles")).toBe(
      "https://wa.me/254700000000?text=Two%20cakes%20%F0%9F%8E%82%20%26%20candles",
    );
  });
  it("normalises local formats first", () => {
    expect(waHref("0712345678", "hi")).toBe("https://wa.me/254712345678?text=hi");
  });
  it("throws on unusable numbers", () => {
    expect(() => waHref("banana", "hi")).toThrow();
  });
});

describe("getShopWhatsapp", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("reads and normalises NEXT_PUBLIC_SHOP_WHATSAPP", () => {
    vi.stubEnv("NEXT_PUBLIC_SHOP_WHATSAPP", "0700000000");
    expect(getShopWhatsapp()).toBe("254700000000");
  });
  it("throws when missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SHOP_WHATSAPP", "");
    expect(() => getShopWhatsapp()).toThrow(/NEXT_PUBLIC_SHOP_WHATSAPP/);
  });
  it("throws when invalid", () => {
    vi.stubEnv("NEXT_PUBLIC_SHOP_WHATSAPP", "not-a-number");
    expect(() => getShopWhatsapp()).toThrow();
  });
});
