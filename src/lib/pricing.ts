// Pure pricing functions (unit tested). All money in integer KES.

export interface CakePriceInput {
  pricePerKg: number;
  sizeKg: number;
  tierExtraFee: number;
}

export function cakePrice(i: CakePriceInput): number {
  return Math.round(i.pricePerKg * i.sizeKg + i.tierExtraFee);
}

export interface PastryLine {
  unitPrice: number;
  quantity: number;
}

export function lineTotal(l: PastryLine): number {
  return l.unitPrice * l.quantity;
}

export function cartSubtotal(lines: PastryLine[]): number {
  return lines.reduce((s, l) => s + lineTotal(l), 0);
}

export function orderTotal(subtotal: number, deliveryFee: number): number {
  return subtotal + Math.max(0, deliveryFee);
}

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
