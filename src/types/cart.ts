/** Cart item for a custom cake build. */
export interface CakeCartItem {
  kind: "cake";
  flavourId: string;
  flavourName: string;
  flavourPricePerKg: number;
  sizeId: string;
  kg: number;
  tierId: string;
  tierName: string;
  tierExtraFee: number;
  tierRequiresQuote: boolean;
  designDescription: string;
  cakeMessage: string;
  allergies: string;
  /**
   * Storage paths of the uploaded reference photos (`cakes/<id>.jpg`).
   *
   * Paths, not `File` objects: the files are uploaded to Supabase storage as
   * soon as the customer picks them, so they survive a page reload and can be
   * attached to the order.
   */
  referencePhotos: string[];
}

export interface PastryCartItem {
  kind: "pastry";
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export type CartItem = CakeCartItem | PastryCartItem;

/** How the order will be collected — chosen in the cake builder. */
export interface CartFulfilment {
  kind: "pickup" | "delivery";
  /** Delivery zone id; null for pickup. */
  zoneId: string | null;
  zoneName: string | null;
  fee: number;
  /**
   * True once the customer has actually made this choice in the builder.
   *
   * Until then the checkout form uses its own default, so a customer who only
   * ordered pastries is not told they already picked up.
   */
  chosen: boolean;
}

/**
 * Order-level details.
 *
 * The date and the fulfilment belong to the order, not to a single item, so
 * they live beside the items. The cake builder collects them (spec §6.1 steps
 * 6 and 7) and the checkout form starts from them instead of asking again.
 */
export interface CartOrderDetails {
  /** YYYY-MM-DD */
  dateNeeded: string | null;
  /** HH:MM */
  timeNeeded: string | null;
  fulfilment: CartFulfilment;
}

export const EMPTY_CART_DETAILS: CartOrderDetails = {
  dateNeeded: null,
  timeNeeded: null,
  fulfilment: { kind: "pickup", zoneId: null, zoneName: null, fee: 0, chosen: false },
};

/** A fresh copy — never share the constant itself, it can be mutated. */
export function freshCartDetails(): CartOrderDetails {
  return { ...EMPTY_CART_DETAILS, fulfilment: { ...EMPTY_CART_DETAILS.fulfilment } };
}

export interface CartState {
  items: CartItem[];
  /** Sum of all line totals (client display only — server recomputes). */
  cartTotal: number;
  itemCount: number;
  hasCakes: boolean;
  /** Date + fulfilment collected in the builder. */
  details: CartOrderDetails;
  /** True if any cake ≥ threshold kg OR any cake tier ≠ Simple. */
  hasCakesRequiringDeposit: (depositThresholdKg: number) => boolean;
  addCake: (item: Omit<CakeCartItem, "kind">) => void;
  addPastry: (item: Omit<PastryCartItem, "kind">) => void;
  updateCake: (id: string, patch: Partial<Omit<CakeCartItem, "kind">>) => void;
  updatePastryQty: (productId: string, quantity: number) => void;
  /** Remove by the item's id: the flavour id for a cake, the product id for a pastry. */
  removeItem: (id: string) => void;
  /** Merge new order-level details (date, time, fulfilment) into the cart. */
  setDetails: (details: Partial<CartOrderDetails>) => void;
  clear: () => void;
}
