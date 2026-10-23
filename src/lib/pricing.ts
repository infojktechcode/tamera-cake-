// Pure, testable cake and cart price functions (money in integer KES).

import type { CakeCartItem, PastryCartItem } from "../types/cart";

/** Cake price — base + tier extra fee, all integer KES. */
export function cakePrice(i: { pricePerKg: number; sizeKg: number; tierExtraFee: number }): number {
  return Math.round(i.pricePerKg * i.sizeKg + i.tierExtraFee);
}

/** Line total for a pastry line. */
export function lineTotal(l: PastryLine): number {
  return l.unitPrice * l.quantity;
}

interface PastryLine {
  unitPrice: number;
  quantity: number;
}

/** Cart subtotal across pastry lines (cake handled separately by cart-store). */
export function cartSubtotal(lines: PastryLine[]): number {
  return lines.reduce((s, l) => s + lineTotal(l), 0);
}

/** Deposit rule — shared by client UI and server compute so they never disagree. */
export interface DepositRequiredInput {
  anyCakeOverThreshold: boolean;
  anyNonSimpleTier: boolean;
  total: number;
  depositPercent: number;
}

export function depositRequired(i: DepositRequiredInput): number {
  if (!i.anyCakeOverThreshold && !i.anyNonSimpleTier) return 0;
  return Math.round((i.total * i.depositPercent) / 100);
}
