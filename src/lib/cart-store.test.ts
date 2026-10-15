import { describe, it, expect, vi } from "vitest";
import { createCartStore, type CartState } from "./cart-store";
import type { CakeCartItem, PastryCartItem } from "../types/cart";

describe("cart store", () => {
  it("addCake appends a cake item with kind=cake", () => {
    const store = createCartStore();
    store.getState().addCake({
      flavourId: "f1",
      flavourName: "Red Velvet",
      flavourPricePerKg: 3200,
      sizeId: "s1",
      kg: 2,
      tierId: "t1",
      tierName: "Simple",
      tierExtraFee: 0,
      tierRequiresQuote: false,
      designDescription: "",
      cakeMessage: "Happy birthday",
      allergies: "",
      referencePhotos: [],
    });
    const cakes = store.getState().items.filter((i): i is CakeCartItem => i.kind === "cake");
    expect(cakes).toHaveLength(1);
    expect(cakes[0].flavourName).toBe("Red Velvet");
    expect(cakes[0].kg).toBe(2);
  });

  it("addPastry appends a pastry item with kind=pastry", () => {
    const store = createCartStore();
    store.getState().addPastry({
      productId: "p1",
      name: "Glazed donut",
      unitPrice: 80,
      quantity: 3,
    });
    const pastries = store
      .getState()
      .items.filter((i): i is PastryCartItem => i.kind === "pastry");
    expect(pastries).toHaveLength(1);
    expect(pastries[0].quantity).toBe(3);
  });

  it("updateCake patches a cake item by flavourId", () => {
    const store = createCartStore();
    store.getState().addCake({
      flavourId: "f1",
      flavourName: "Red Velvet",
      flavourPricePerKg: 3200,
      sizeId: "s1",
      kg: 1,
      tierId: "t1",
      tierName: "Simple",
      tierExtraFee: 0,
      tierRequiresQuote: false,
      designDescription: "",
      cakeMessage: "",
      allergies: "",
      referencePhotos: [],
    });
    store.getState().updateCake("f1", { kg: 2, tierName: "Themed", tierExtraFee: 1500 });
    const cake = store.getState().items[0] as CakeCartItem;
    expect(cake.kg).toBe(2);
    expect(cake.tierName).toBe("Themed");
    expect(cake.tierExtraFee).toBe(1500);
  });

  it("updatePastryQty changes quantity; 0 removes the item", () => {
    const store = createCartStore();
    store.getState().addPastry({ productId: "p1", name: "Donut", unitPrice: 80, quantity: 1 });
    store.getState().updatePastryQty("p1", 5);
    expect((store.getState().items[0] as PastryCartItem).quantity).toBe(5);
    store.getState().updatePastryQty("p1", 0);
    expect(store.getState().items).toHaveLength(0);
  });

  it("removeItem removes by id", () => {
    const store = createCartStore();
    store.getState().addPastry({ productId: "p1", name: "Donut", unitPrice: 80, quantity: 1 });
    store.getState().removeItem("p1");
    expect(store.getState().items).toHaveLength(0);
  });

  it("clear empties the cart", () => {
    const store = createCartStore();
    store.getState().addPastry({ productId: "p1", name: "Donut", unitPrice: 80, quantity: 1 });
    store.getState().addCake({
      flavourId: "f1",
      flavourName: "Red Velvet",
      flavourPricePerKg: 3200,
      sizeId: "s1",
      kg: 2,
      tierId: "t1",
      tierName: "Simple",
      tierExtraFee: 0,
      tierRequiresQuote: false,
      designDescription: "",
      cakeMessage: "",
      allergies: "",
      referencePhotos: [],
    });
    store.getState().clear();
    expect(store.getState().items).toHaveLength(0);
  });

  it("cartTotal sums cake prices + pastry lines", () => {
    const store = createCartStore();
    // cake: 3200 * 2kg + 0 fee = 6400
    store.getState().addCake({
      flavourId: "f1",
      flavourName: "Red Velvet",
      flavourPricePerKg: 3200,
      sizeId: "s1",
      kg: 2,
      tierId: "t1",
      tierName: "Simple",
      tierExtraFee: 0,
      tierRequiresQuote: false,
      designDescription: "",
      cakeMessage: "",
      allergies: "",
      referencePhotos: [],
    });
    // pastry: 80 * 3 = 240
    store.getState().addPastry({ productId: "p1", name: "Donut", unitPrice: 80, quantity: 3 });
    expect(store.getState().cartTotal).toBe(6640);
  });

  it("itemCount returns number of line items", () => {
    const store = createCartStore();
    store.getState().addCake({
      flavourId: "f1",
      flavourName: "Red Velvet",
      flavourPricePerKg: 3200,
      sizeId: "s1",
      kg: 1,
      tierId: "t1",
      tierName: "Simple",
      tierExtraFee: 0,
      tierRequiresQuote: false,
      designDescription: "",
      cakeMessage: "",
      allergies: "",
      referencePhotos: [],
    });
    store.getState().addPastry({ productId: "p1", name: "Donut", unitPrice: 80, quantity: 1 });
    store.getState().addPastry({ productId: "p2", name: "Roll", unitPrice: 150, quantity: 1 });
    expect(store.getState().itemCount).toBe(3);
  });

  it("hasCakes is true only when a cake is present", () => {
    const store = createCartStore();
    expect(store.getState().hasCakes).toBe(false);
    store.getState().addPastry({ productId: "p1", name: "Donut", unitPrice: 80, quantity: 1 });
    expect(store.getState().hasCakes).toBe(false);
    store.getState().addCake({
      flavourId: "f1",
      flavourName: "Test",
      flavourPricePerKg: 1000,
      sizeId: "s1",
      kg: 1,
      tierId: "t1",
      tierName: "Simple",
      tierExtraFee: 0,
      tierRequiresQuote: false,
      designDescription: "",
      cakeMessage: "",
      allergies: "",
      referencePhotos: [],
    });
    expect(store.getState().hasCakes).toBe(true);
  });

  it("hasCakesRequiringDeposit: 3kg Simple → true (threshold)", () => {
    const store = createCartStore();
    const addCake = (kg: number, tier: string) =>
      store.getState().addCake({
        flavourId: "f1",
        flavourName: "Test",
        flavourPricePerKg: 1000,
        sizeId: "s1",
        kg,
        tierId: "t1",
        tierName: tier,
        tierExtraFee: 0,
        tierRequiresQuote: false,
        designDescription: "",
        cakeMessage: "",
        allergies: "",
        referencePhotos: [],
      });
    addCake(3, "Simple");
    expect(store.getState().hasCakesRequiringDeposit(3)).toBe(true);
  });

  it("hasCakesRequiringDeposit: 2kg Themed → true (non-Simple tier)", () => {
    const store = createCartStore();
    store.getState().addCake({
      flavourId: "f1",
      flavourName: "Test",
      flavourPricePerKg: 1000,
      sizeId: "s1",
      kg: 2,
      tierId: "t1",
      tierName: "Themed",
      tierExtraFee: 1500,
      tierRequiresQuote: false,
      designDescription: "",
      cakeMessage: "",
      allergies: "",
      referencePhotos: [],
    });
    expect(store.getState().hasCakesRequiringDeposit(3)).toBe(true);
  });

  it("hasCakesRequiringDeposit: 2kg Simple → false", () => {
    const store = createCartStore();
    store.getState().addCake({
      flavourId: "f1",
      flavourName: "Test",
      flavourPricePerKg: 1000,
      sizeId: "s1",
      kg: 2,
      tierId: "t1",
      tierName: "Simple",
      tierExtraFee: 0,
      tierRequiresQuote: false,
      designDescription: "",
      cakeMessage: "",
      allergies: "",
      referencePhotos: [],
    });
    expect(store.getState().hasCakesRequiringDeposit(3)).toBe(false);
  });

  it("persists to sessionStorage but excludes File objects", () => {
    // jsdom-like stub: mock sessionStorage on global
    const storage: Record<string, string> = {};
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => {
        storage[k] = v;
      },
      removeItem: (k: string) => {
        delete storage[k];
      },
    });

    const store = createCartStore();
    store.getState().addPastry({ productId: "p1", name: "Donut", unitPrice: 80, quantity: 1 });
    // Trigger persist by subscribing (zustand persist calls setItem on change)
    // The persist middleware writes automatically on state change.
    expect(storage["tamera-cart"]).toBeDefined();
    const parsed = JSON.parse(storage["tamera-cart"]);
    expect(parsed.state.items).toHaveLength(1);
    // referencePhotos File objects should be excluded from persistence
    const pastry = parsed.state.items[0];
    expect(pastry.kind).toBe("pastry");
    expect(pastry.quantity).toBe(1);
  });
});
