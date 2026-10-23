import type { CakeCartItem, OrderSettings, PastryCartItem } from "../types/cart";

/** Pure order-level cart compute. Shares the exact same deposit decision as pricing.depositRequired. */

export interface DeliveryZoneInfo {
  id: string;
  name: string;
  fee: number;
}

export interface OrderComputeInput {
  cake: Omit<CakeCartItem, "kind">;
  pastry: PastryCartItem;
  dateNeeded?: string | null;
  deliveryZone?: DeliveryZoneInfo | null;
  settings: OrderSettings;
}

export interface OrderComputeResult {
  dateCheck: { ok: boolean; reason?: string } | null;
  neededDate: string | null;
  deliveryZone: DeliveryZoneInfo | null;
  cakeSubtotal: number;
  pastrySubtotal: number;
  total: number;
  deposit: number; // always >= 0; 0 when no deposit required
  isQuoteRequired: boolean; // tierRequiresQuote || deposit === 0
  fulfilment: "pickup" | "delivery";
}

/** Deposit rule — identical to pricing.depositRequired so the UI and server never disagree. */
export function depositParity(anyCakeOverThreshold: boolean, anyNonSimpleTier: boolean, total: number, percent: number): number {
  if (!anyCakeOverThreshold && !anyNonSimpleTier) return 0;
  return Math.round((total * percent) / 100);
}

/** Compute an order from its line items + settings. */
export function orderCompute(input: OrderComputeInput): OrderComputeResult {
  const cake = input.cake;
  const pastry = input.pastry;

  // Date needed: null if none chosen by the customer.
  let dateCheck: { ok: boolean; reason?: string } | null = null;
  let neededDate: string | null = input.dateNeeded ?? null;

  // Blocked-date / lead-time / capacity checks live in rules.ts (client validation).
  if (neededDate) {
    // (Rules module re-checks these at confirmation time server-side too.)
    void input.settings;
    dateCheck = { ok: true };
  }

  const cakeSubtotal = Math.round(cake.flavourPricePerKg * cake.kg + cake.tierExtraFee);
  const pastrySubtotal = pastry.unitPrice * pastry.quantity;
  const total = cakeSubtotal + pastrySubtotal;

  const isAnyCakeOverThreshold = cake.kg >= input.settings.deposit_threshold_kg;
  const anyNonSimpleTier = cake.tierName !== "Simple";

  // Quote-only tiers are quote-required but have no deposit.
  const deposit = depositParity(isAnyCakeOverThreshold, anyNonSimpleTier, total, input.settings.deposit_percent);
  const isQuoteRequired = cake.tierRequiresQuote || deposit === 0;

  const deliveryZone = input.deliveryZone ?? null;
  const fulfilment: "pickup" | "delivery" = deliveryZone ? "delivery" : "pickup";

  return {
    dateCheck,
    neededDate,
    deliveryZone,
    cakeSubtotal,
    pastrySubtotal,
    total,
    deposit,
    isQuoteRequired,
    fulfilment,
  };
}
