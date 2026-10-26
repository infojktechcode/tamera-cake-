import { describe, expect, it } from "vitest";

import { buildProductImagePath, resolveProductImage } from "./product-image";

describe("resolveProductImage", () => {
  const supabase = "https://abc.supabase.co";

  it("returns null when there is no photo", () => {
    expect(resolveProductImage(null, supabase)).toBeNull();
    expect(resolveProductImage("", supabase)).toBeNull();
  });

  it("leaves a public path alone", () => {
    expect(resolveProductImage("/showcase/01.jpg", supabase)).toBe("/showcase/01.jpg");
  });

  it("leaves a full url alone", () => {
    expect(resolveProductImage("https://cdn.example.com/a.jpg", supabase)).toBe(
      "https://cdn.example.com/a.jpg",
    );
  });

  it("turns a storage path into the public bucket url", () => {
    expect(resolveProductImage("products/a.jpg", supabase)).toBe(
      "https://abc.supabase.co/storage/v1/object/public/product-images/products/a.jpg",
    );
  });

  it("tolerates a trailing slash on the project url", () => {
    expect(resolveProductImage("products/a.jpg", `${supabase}/`)).toBe(
      "https://abc.supabase.co/storage/v1/object/public/product-images/products/a.jpg",
    );
  });

  it("returns null when the project url is missing", () => {
    expect(resolveProductImage("products/a.jpg", undefined)).toBeNull();
  });
});

describe("buildProductImagePath", () => {
  it("uses the mime type for the extension", () => {
    expect(buildProductImagePath("image/jpeg", "abc")).toBe("products/abc.jpg");
    expect(buildProductImagePath("image/png", "abc")).toBe("products/abc.png");
    expect(buildProductImagePath("image/webp", "abc")).toBe("products/abc.webp");
  });

  it("refuses anything that is not a photo", () => {
    expect(() => buildProductImagePath("image/gif", "abc")).toThrow();
    expect(() => buildProductImagePath("text/html", "abc")).toThrow();
  });
});
