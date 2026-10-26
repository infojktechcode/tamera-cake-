import { describe, expect, it } from "vitest";

import {
  draftFromProduct,
  isProductDirty,
  isValidProductImagePath,
  marginPercent,
  productChanges,
  profitPerUnit,
  type AdminProduct,
  type ProductDraft,
} from "./product-edit";

function product(overrides: Partial<AdminProduct> = {}): AdminProduct {
  return {
    id: "p1",
    name: "Banana loaf",
    slug: "banana-loaf",
    description: null,
    categoryName: "Pastries",
    kind: "pastry",
    price: 450,
    available: true,
    trackStock: true,
    stockQty: 20,
    lowStockLevel: 3,
    imageUrl: null,
    costPrice: 200,
    sortOrder: 1,
    ...overrides,
  };
}

function draft(overrides: Partial<ProductDraft> = {}): ProductDraft {
  return { ...draftFromProduct(product()), ...overrides };
}

describe("marginPercent", () => {
  it("measures profit against the selling price", () => {
    expect(marginPercent(450, 200)).toBe(55.6);
  });

  it("handles a cheap product", () => {
    expect(marginPercent(80, 30)).toBe(62.5);
  });

  it("is negative when sold below cost", () => {
    expect(marginPercent(100, 125)).toBe(-25);
  });

  it("says nothing when there is no cost or no price", () => {
    expect(marginPercent(450, null)).toBeNull();
    expect(marginPercent(0, 200)).toBeNull();
  });
});

describe("profitPerUnit", () => {
  it("subtracts the cost", () => {
    expect(profitPerUnit(450, 200)).toBe(250);
  });

  it("is null without a cost", () => {
    expect(profitPerUnit(450, null)).toBeNull();
  });
});

describe("isValidProductImagePath", () => {
  it("accepts the seeded showcase photos", () => {
    expect(isValidProductImagePath("/showcase/01-black-forest.jpg")).toBe(true);
  });

  it("accepts an uploaded storage path", () => {
    expect(isValidProductImagePath("products/0b4c1f2e-7d3a-4f8b-9c1e-123456789abc.jpg")).toBe(
      true,
    );
    expect(isValidProductImagePath("products/photo-1.webp")).toBe(true);
  });

  it("refuses traversal and other buckets", () => {
    expect(isValidProductImagePath("products/../cake-references/x.jpg")).toBe(false);
    expect(isValidProductImagePath("cake-references/x.jpg")).toBe(false);
    expect(isValidProductImagePath("/etc/passwd")).toBe(false);
    expect(isValidProductImagePath("https://evil.example/x.jpg")).toBe(false);
  });

  it("refuses the wrong extension and empty paths", () => {
    expect(isValidProductImagePath("products/x.exe")).toBe(false);
    expect(isValidProductImagePath("")).toBe(false);
    expect(isValidProductImagePath("/showcase/x.png")).toBe(false);
  });
});

describe("productChanges", () => {
  it("sends nothing when the row was not touched", () => {
    expect(productChanges(draft(), draft())).toEqual({});
    expect(isProductDirty(draft(), draft())).toBe(false);
  });

  it("sends only the fields that moved", () => {
    const changed = draft({ price: 500, available: false });
    expect(productChanges(draft(), changed)).toEqual({ price: 500, available: false });
    expect(isProductDirty(draft(), changed)).toBe(true);
  });

  it("picks up a stock change on a tracked pastry", () => {
    expect(productChanges(draft(), draft({ stockQty: 18 }))).toEqual({ stockQty: 18 });
  });
});
