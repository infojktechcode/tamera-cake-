/**
 * Walk-in sale arithmetic (spec §6.2).
 *
 * A walk-in is a shop customer buying pastries over the counter. The browser
 * sends product ids and quantities only; the server loads the prices and
 * computes the total here, exactly like the online order route does.
 */

export interface WalkInRequestLine {
  productId: string;
  quantity: number;
}

export interface WalkInProduct {
  id: string;
  name: string;
  price: number;
  available: boolean;
  track_stock: boolean;
  stock_qty: number;
}

export interface WalkInLine {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export type WalkInResult =
  | { ok: true; lines: WalkInLine[]; total: number }
  | { ok: false; error: string };

/** Merge repeated product ids so two taps of "+" are one line. */
export function mergeWalkInLines(items: WalkInRequestLine[]): WalkInRequestLine[] {
  const merged = new Map<string, number>();
  for (const item of items) {
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }
  return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export function computeWalkIn(
  items: WalkInRequestLine[],
  products: WalkInProduct[],
): WalkInResult {
  const merged = mergeWalkInLines(items);
  if (merged.length === 0) return { ok: false, error: "Add at least one item." };

  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: WalkInLine[] = [];

  for (const item of merged) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return { ok: false, error: "Quantities must be whole numbers above zero." };
    }
    if (item.quantity > 50) {
      return { ok: false, error: "That is too many for one line — split the sale." };
    }

    const product = byId.get(item.productId);
    if (!product) return { ok: false, error: "One of those items is not in the catalogue." };
    if (!product.available) {
      return { ok: false, error: `${product.name} is not available right now.` };
    }
    if (product.track_stock && product.stock_qty < item.quantity) {
      return {
        ok: false,
        error:
          product.stock_qty === 0
            ? `${product.name} is out of stock.`
            : `Only ${product.stock_qty} ${product.name} left.`,
      };
    }

    lines.push({
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
      lineTotal: product.price * item.quantity,
    });
  }

  return {
    ok: true,
    lines,
    total: lines.reduce((sum, line) => sum + line.lineTotal, 0),
  };
}
