/**
 * Catalogue editing rules (spec §6.2).
 *
 * The products screen edits four tables — products, cake flavours, cake sizes
 * and design tiers. The arithmetic and the guards that do not need a database
 * live here so they can be tested without Supabase; the routes are still the
 * boundary that enforces role permissions.
 */

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryName: string;
  kind: "cake" | "pastry";
  price: number;
  available: boolean;
  trackStock: boolean;
  stockQty: number;
  lowStockLevel: number;
  imageUrl: string | null;
  /** Only filled in for the owner; managers never receive a cost. */
  costPrice: number | null;
  sortOrder: number;
}

export interface AdminFlavour {
  id: string;
  name: string;
  pricePerKg: number;
  available: boolean;
  sortOrder: number;
}

export interface AdminSize {
  id: string;
  kg: number;
  available: boolean;
  sortOrder: number;
}

export interface AdminTier {
  id: string;
  name: string;
  extraFee: number;
  requiresQuote: boolean;
  description: string | null;
  sortOrder: number;
}

/** The fields a row can change. */
export interface ProductDraft {
  price: number;
  available: boolean;
  trackStock: boolean;
  stockQty: number;
  lowStockLevel: number;
}

export function draftFromProduct(product: AdminProduct): ProductDraft {
  return {
    price: product.price,
    available: product.available,
    trackStock: product.trackStock,
    stockQty: product.stockQty,
    lowStockLevel: product.lowStockLevel,
  };
}

/**
 * Profit on the selling price, as a percentage with one decimal.
 *
 * `null` when there is no cost yet or the price is zero — an unknown margin is
 * better than a confident "100%".
 */
export function marginPercent(price: number, cost: number | null): number | null {
  if (cost === null || price <= 0) return null;
  return Math.round(((price - cost) / price) * 1000) / 10;
}

/** Profit in shillings, or null when no cost has been recorded. */
export function profitPerUnit(price: number, cost: number | null): number | null {
  if (cost === null) return null;
  return price - cost;
}

/**
 * Is this a path we are willing to store in `products.image_url`?
 *
 * Two shapes exist: the seed's public showcase photos (`/showcase/*.jpg`) and
 * uploads from this dashboard (`products/<random>.<ext>`). Anything else —
 * another customer's file, a traversal, a remote URL — is refused so the
 * column can never be pointed somewhere unexpected.
 */
export function isValidProductImagePath(value: string): boolean {
  if (value.length > 300) return false;
  return (
    /^\/showcase\/[a-z0-9][a-z0-9._-]*\.jpg$/i.test(value) ||
    /^products\/[a-z0-9][a-z0-9-]*\.(jpg|png|webp)$/i.test(value)
  );
}

/** The changes a draft makes to a product, so a save only sends what moved. */
export function productChanges(
  original: ProductDraft,
  draft: ProductDraft,
): Partial<ProductDraft> {
  const patch: Partial<ProductDraft> = {};
  if (draft.price !== original.price) patch.price = draft.price;
  if (draft.available !== original.available) patch.available = draft.available;
  if (draft.trackStock !== original.trackStock) patch.trackStock = draft.trackStock;
  if (draft.stockQty !== original.stockQty) patch.stockQty = draft.stockQty;
  if (draft.lowStockLevel !== original.lowStockLevel) {
    patch.lowStockLevel = draft.lowStockLevel;
  }
  return patch;
}

/** True when the row has unsaved edits. */
export function isProductDirty(original: ProductDraft, draft: ProductDraft): boolean {
  return Object.keys(productChanges(original, draft)).length > 0;
}
