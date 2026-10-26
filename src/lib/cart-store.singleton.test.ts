import { describe, it, expect } from "vitest";
import { useCart } from "./cart-store";

/**
 * The singleton seam. `createCartStore()` stays the pure, per-call factory the
 * other tests use; `useCart` is the one store every client component shares,
 * so a cake added in the builder is visible in the cart drawer.
 */
describe("useCart singleton", () => {
  it("is a zustand store exposing getState", () => {
    expect(typeof useCart.getState).toBe("function");
    expect(Array.isArray(useCart.getState().items)).toBe(true);
  });

  it("shares state across repeated getState() calls (same store instance)", () => {
    const before = useCart.getState().items.length;
    useCart.getState().addPastry({
      productId: "singleton-p1",
      name: "Croissant",
      unitPrice: 80,
      quantity: 2,
    });
    const after = useCart.getState().items.length;
    expect(after).toBe(before + 1);
    // A second call must observe the mutation — i.e. one shared store, not a new one.
    expect(useCart.getState().items.length).toBe(after);
  });

  it("clears back to empty", () => {
    useCart.getState().clear();
    expect(useCart.getState().items).toHaveLength(0);
    expect(useCart.getState().cartTotal).toBe(0);
    expect(useCart.getState().itemCount).toBe(0);
  });
});
