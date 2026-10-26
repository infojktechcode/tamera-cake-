import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  CakeCartItem,
  CartOrderDetails,
  PastryCartItem,
  CartItem,
  CartState,
} from "../types/cart";
import { freshCartDetails } from "../types/cart";

// --- pure cart helpers (exportable for testing/SSR) ---

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    if (item.kind === "cake") {
      return sum + Math.round(item.flavourPricePerKg * item.kg + item.tierExtraFee);
    }
    return sum + item.unitPrice * item.quantity;
  }, 0);
}

export function itemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + (item.kind === "cake" ? 1 : item.quantity), 0);
}

export function hasCakes(items: CartItem[]): boolean {
  return items.some((i) => i.kind === "cake");
}

/**
 * True when the order needs a deposit.
 *
 * Mirrors the server rule in `order-compute.ts`: a cake at or above the
 * threshold, or a tier other than Simple, needs a deposit — but a design that
 * the shop still has to quote does not (there is no final price to take a
 * percentage of yet).
 */
export function hasCakesRequiringDeposit(
  items: CartItem[],
  depositThresholdKg: number,
): boolean {
  return items.some((item) => {
    if (item.kind !== "cake") return false;
    if (item.tierRequiresQuote) return false;
    return item.kg >= depositThresholdKg || item.tierName !== "Simple";
  });
}

// --- re-exports for test imports ---

export type { CartState } from "../types/cart";

/** Recompute derived fields from items. */
function recompute(items: CartItem[]) {
  return {
    items,
    cartTotal: cartTotal(items),
    itemCount: itemCount(items),
    hasCakes: hasCakes(items),
  };
}

/** Re-create the store per call (for testing). Production uses the singleton. */
export function createCartStore() {
  return create<CartState>()(
    persist(
      (set, get) => ({
        ...recompute([]),
        details: freshCartDetails(),

        hasCakesRequiringDeposit: (depositThresholdKg: number) =>
          hasCakesRequiringDeposit(get().items, depositThresholdKg),

        addCake: (item) => {
          const cake: CakeCartItem = { ...item, kind: "cake" };
          set((state) => recompute([...state.items, cake]));
        },

        addPastry: (item) => {
          set((state) => {
            const existing = state.items.find(
              (i): i is PastryCartItem => i.kind === "pastry" && i.productId === item.productId,
            );
            if (existing) {
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
                    (i): i is PastryCartItem =>
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

        setDetails: (details: Partial<CartOrderDetails>) => {
          set((state) => ({
            ...state,
            details: {
              ...state.details,
              ...details,
              fulfilment: {
                ...state.details.fulfilment,
                ...(details.fulfilment ?? {}),
              },
            },
          }));
        },

        clear: () => set(() => ({ ...recompute([]), details: freshCartDetails() })),
      }),
      {
        name: "tamera-cart",
        storage: createJSONStorage(() => sessionStorage as unknown as Storage),
        // Only plain data is persisted — items and the order-level details.
        partialize: (state) => ({
          items: state.items,
          details: state.details,
        }),
      },
    ),
  );
}

/**
 * The one store every client component shares.
 *
 * `createCartStore()` above stays the per-call factory the unit tests use.
 * This module-level instance is what the builder, pastry browser and cart
 * drawer all talk to, so a cake added in the builder is visible in the drawer.
 */
export const useCart = createCartStore();
