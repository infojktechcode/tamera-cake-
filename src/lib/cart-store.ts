import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CakeCartItem, CartItem, CartState } from "../types/cart";

/** Pure cart helpers (exported for testing/SSR). */

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + cartLineTotal(item), 0);
}

function cartLineTotal(item: CartItem): number {
  if (item.kind === "cake") {
    return Math.round((item.flavourPricePerKg * item.kg + (item as CakeCartItem).tierExtraFee));
  }
  return item.unitPrice * item.quantity;
}

export function itemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + (item.kind === "cake" ? 1 : item.quantity), 0);
}

export function hasCakes(items: CartItem[]): boolean {
  return items.some((i) => i.kind === "cake");
}

export function hasCakesRequiringDeposit(items: CartItem[], threshold: number): boolean {
  return items.some(
    (i) => i.kind === "cake" && (i.kg >= threshold || i.tierName !== "Simple")
  );
}

/** Recompute derived fields from items. */
function recompute(items: CartItem[]) {
  return {
    items,
    cartTotal: cartTotal(items),
    itemCount: itemCount(items),
    hasCakes: hasCakes(items),
    hasCakesRequiringDeposit: (threshold: number) => hasCakesRequiringDeposit(items, threshold),
  };
}

/** Create a fresh store instance — call once per page load / test. */
export function createCartStore() {
  return create<CartState>()(
    persist(
      (set) => ({
        ...recompute([]),


        // Quote-only tiers never show a deposit.
        depositRequired: false,

        addCake: (item) => {
          const cake: CakeCartItem = { ...item, kind: "cake" };
          set((state) => recompute([...state.items, cake]));
        },

        addPastry: (item) => {
          set((state) => {
            const existingPastry = state.items.find(
              (i): i is Extract<CartItem, { kind: "pastry" }> => i.kind === "pastry" && i.productId === item.productId,
            );
            if (existingPastry) {
              return recompute(
                state.items.map((i) =>
                  i.kind === "pastry" && i.productId === item.productId
                    ? { ...i, quantity: i.quantity + item.quantity }
                    : i,
                ),
              );
            }
            return recompute([...state.items, { ...item, kind: "pastry" }]);
          });
        },

        updateCake: (flavourId, patch) => {
          set((state) =>
            recompute(
              state.items.map((i) =>
                i.kind === "cake" && i.flavourId === flavourId ? { ...i, ...patch } : i,
              ),
            ),
          );
        },

        updatePastryQty: (productId, quantity) => {
          set((state) =>
            recompute(
              quantity <= 0
                ? state.items.filter(
                    (i): i is Extract<CartItem, { kind: "pastry" }> =>
                      !(i.kind === "pastry" && i.productId === productId),
                  )
                : state.items.map((i) =>
                    i.kind === "pastry" && i.productId === productId ? { ...i, quantity } : i,
                  ),
            ),
          );
        },

        removeItem: (id) => {
          set((state) =>
            recompute(
              state.items.filter(
                (i) =>
                  !(i.kind === "cake" && i.flavourId === id) &&
                  !(i.kind === "pastry" && i.productId === id),
              ),
            ),
          );
        },

        clear: () => set(() => recompute([])),
      }),
      {
        name: "tamera-cart",
        storage: createJSONStorage(() => sessionStorage as unknown as Storage),
        // Photos are now plain strings and persist naturally.
      },
    ),
  );
}

export const useCartStore = createCartStore();
