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
  /** Storage paths to reference photos, persisted in sessionStorage. */
  referencePhotos: string[];
  /** Optional order-level details carried through from the builder/checkout. */
  dateNeeded?: string | null;
  deliveryZone?: { id: string; name: string; fee: number } | null;
}

export interface PastryCartItem {
  kind: "pastry";
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export type CartItem = CakeCartItem | PastryCartItem;

export interface CartState {
  items: CartItem[];
  /** Sum of all line totals (client display only — server recomputes). */
  cartTotal: number;
  itemCount: number;
  hasCakes: boolean;
  /** True if any cake ≥ threshold kg OR any cake tier ≠ Simple. */
  hasCakesRequiringDeposit: (depositThresholdKg: number) => boolean;
  addCake: (item: Omit<CakeCartItem, "kind">) => void;
  addPastry: (item: Omit<PastryCartItem, "kind">) => void;
  updateCake: (id: string, patch: Partial<Omit<CakeCartItem, "kind">>) => void;
  updatePastryQty: (productId: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clear: () => void;
}
