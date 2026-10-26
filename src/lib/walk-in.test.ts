import { describe, expect, it } from "vitest";

import { computeWalkIn, mergeWalkInLines, type WalkInProduct } from "./walk-in";

function product(overrides: Partial<WalkInProduct> = {}): WalkInProduct {
  return {
    id: "p1",
    name: "Glazed donut",
    price: 80,
    available: true,
    track_stock: true,
    stock_qty: 20,
    ...overrides,
  };
}

describe("mergeWalkInLines", () => {
  it("adds up repeated taps of the same product", () => {
    expect(
      mergeWalkInLines([
        { productId: "p1", quantity: 1 },
        { productId: "p2", quantity: 2 },
        { productId: "p1", quantity: 3 },
      ]),
    ).toEqual([
      { productId: "p1", quantity: 4 },
      { productId: "p2", quantity: 2 },
    ]);
  });
});

describe("computeWalkIn", () => {
  it("prices the lines from the catalogue, not from the request", () => {
    const result = computeWalkIn([{ productId: "p1", quantity: 3 }], [product()]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines[0]).toMatchObject({ unitPrice: 80, lineTotal: 240 });
    expect(result.total).toBe(240);
  });

  it("adds the lines up", () => {
    const result = computeWalkIn(
      [
        { productId: "p1", quantity: 2 },
        { productId: "p2", quantity: 1 },
      ],
      [product(), product({ id: "p2", name: "Croissant", price: 150 })],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.total).toBe(310);
  });

  it("refuses an empty sale", () => {
    const result = computeWalkIn([], [product()]);
    expect(result.ok).toBe(false);
  });

  it("refuses a quantity that is not a whole number", () => {
    const result = computeWalkIn([{ productId: "p1", quantity: 1.5 }], [product()]);
    expect(result.ok).toBe(false);
  });

  it("refuses more than fifty of one line", () => {
    const result = computeWalkIn([{ productId: "p1", quantity: 51 }], [product({ stock_qty: 100 })]);
    expect(result.ok).toBe(false);
  });

  it("refuses a product that is not in the catalogue", () => {
    const result = computeWalkIn([{ productId: "nope", quantity: 1 }], [product()]);
    expect(result.ok).toBe(false);
  });

  it("refuses an item that is switched off", () => {
    const result = computeWalkIn(
      [{ productId: "p1", quantity: 1 }],
      [product({ available: false })],
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("not available");
  });

  it("refuses more than the shelf holds", () => {
    const result = computeWalkIn(
      [{ productId: "p1", quantity: 5 }],
      [product({ stock_qty: 3 })],
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Only 3");
  });

  it("says so when the shelf is empty", () => {
    const result = computeWalkIn(
      [{ productId: "p1", quantity: 1 }],
      [product({ stock_qty: 0 })],
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("out of stock");
  });

  it("does not check stock for an untracked product", () => {
    const result = computeWalkIn(
      [{ productId: "p1", quantity: 5 }],
      [product({ track_stock: false, stock_qty: 0 })],
    );
    expect(result.ok).toBe(true);
  });
});
