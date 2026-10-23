import { describe, expect, it } from "vitest";

import { resolveProductImage } from "./product-image";

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
