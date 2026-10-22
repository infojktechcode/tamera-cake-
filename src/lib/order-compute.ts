// Pure order computation: given a validated payload AND the resolved DB rows,
// compute every price, deposit and date check.
//
// Nothing in this module touches the network — the route handler pulls the DB
// rows and this module owns the arithmetic. That split is what makes the
// pricing rules testable without a database.
//
// Money is always integer KES. The browser never sends a price: the payload
// carries ids and quantities only (see `validators/order.schema.ts`), and every
// amount below is read from the catalogue rows.

import { cakePrice, depositRequired, lineTotal } from "./pricing";
import { checkDateNeeded } from "./rules";
import type { OrderPayload } from "./validators/order.schema";

export interface ResolvedSize {
  id: string;
  kg: number;
}
export interface ResolvedFlavour {
  id: string;
  name: string;
  pricePerKg: number;
}
export interface ResolvedTier {
  id: string;
  name: string;
  extraFee: number;
  requiresQuote: boolean;
}
export interface ResolvedZone {
  id: string;
  name: string;
  fee: number;
}
export interface ResolvedProduct {
  id: string;
  name: string;
  unitPrice: number;
}

/** The catalogue rows the route resolved for this order. */
export interface CatalogueRows {
  sizes: ResolvedSize[];
  flavours: ResolvedFlavour[];
  tiers: ResolvedTier[];
  zones: ResolvedZone[];
  products: ResolvedProduct[];
}

export interface OrderSettings {
  min_lead_days: number;
  daily_cake_limit: number;
  deposit_percent: number;
  deposit_threshold_kg: number;
}

export interface OrderLine {
  kind: "cake" | "pastry";
  /** Catalogue id: flavour id for cakes, product id for pastries. */
  refId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Cake-only fields; empty strings for pastry lines. */
  sizeKg: number;
  sizeId: string | null;
  flavourName: string;
  tierId: string | null;
  tierName: string;
  designDescription: string;
  cakeMessage: string;
  allergies: string;
  referencePhotos: string[];
}

export interface ComputedOrder {
  customer: OrderPayload["customer"];
  fulfilment: OrderPayload["fulfilment"];
  dateNeeded: string;
  timeNeeded: string | undefined;
  notes: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  depositRequired: number;
  priceNeedsQuote: boolean;
  lines: OrderLine[];
}

export type ComputeResult =
  | { ok: true; order: ComputedOrder }
  | { ok: false; error: string };

export interface ComputeInput {
  payload: OrderPayload;
  catalogue: CatalogueRows;
  settings: OrderSettings;
  /** Blocked dates as YYYY-MM-DD. */
  blockedDates: string[];
  /** Confirmed cakes already booked for `dateNeeded`. */
  confirmedCountOnDate: number;
  now: Date;
}

export function computeOrder(input: ComputeInput): ComputeResult {
  const { payload, catalogue, settings, blockedDates, confirmedCountOnDate, now } = input;

  // --- resolve every referenced row up front, so a bad id fails loudly ---
  const sizeById = new Map(catalogue.sizes.map((s) => [s.id, s]));
  const flavourById = new Map(catalogue.flavours.map((f) => [f.id, f]));
  const tierById = new Map(catalogue.tiers.map((t) => [t.id, t]));
  const productById = new Map(catalogue.products.map((p) => [p.id, p]));

  const lines: OrderLine[] = [];
  let anyCakeOverThreshold = false;
  let anyNonSimpleTier = false;
  let priceNeedsQuote = false;

  for (const item of payload.items) {
    if (item.kind === "pastry") {
      const product = productById.get(item.productId);
      if (!product) {
        return { ok: false, error: `Unknown product: ${item.productId}.` };
      }
      lines.push({
        kind: "pastry",
        refId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.unitPrice,
        lineTotal: lineTotal({ unitPrice: product.unitPrice, quantity: item.quantity }),
        sizeKg: 0,
        sizeId: null,
        flavourName: "",
        tierId: null,
        tierName: "",
        designDescription: "",
        cakeMessage: "",
        allergies: "",
        referencePhotos: [],
      });
      continue;
    }

    const flavour = flavourById.get(item.flavourId);
    if (!flavour) {
      return { ok: false, error: `Unknown cake flavour: ${item.flavourId}.` };
    }
    const size = sizeById.get(item.sizeId);
    if (!size) {
      return { ok: false, error: `Unknown cake size: ${item.sizeId}.` };
    }
    const tier = tierById.get(item.tierId);
    if (!tier) {
      return { ok: false, error: `Unknown design tier: ${item.tierId}.` };
    }

    const kg = Math.round(Number(size.kg));
    const basePrice = cakePrice({
      pricePerKg: flavour.pricePerKg,
      sizeKg: kg,
      tierExtraFee: 0,
    });
    // A quote-only tier carries no confirmed markup: the total stays at the
    // base price until the shop quotes, and no deposit is taken.
    const price = tier.requiresQuote
      ? basePrice
      : cakePrice({
          pricePerKg: flavour.pricePerKg,
          sizeKg: kg,
          tierExtraFee: tier.extraFee,
        });

    lines.push({
      kind: "cake",
      refId: flavour.id,
      productName: `${flavour.name} ${kg}kg`,
      quantity: 1,
      unitPrice: price,
      lineTotal: price,
      sizeKg: kg,
      sizeId: size.id,
      flavourName: flavour.name,
      tierId: tier.id,
      tierName: tier.name,
      designDescription: item.designDescription,
      cakeMessage: item.cakeMessage,
      allergies: item.allergies,
      referencePhotos: item.referencePhotos,
    });

    if (tier.requiresQuote) {
      priceNeedsQuote = true;
    } else {
      if (kg >= settings.deposit_threshold_kg) anyCakeOverThreshold = true;
      if (tier.name !== "Simple") anyNonSimpleTier = true;
    }
  }

  // --- delivery ---
  let deliveryFee = 0;
  const fulfilment = payload.fulfilment;
  if (fulfilment.kind === "delivery") {
    const zone = catalogue.zones.find((z) => z.id === fulfilment.zoneId);
    if (!zone) {
      return { ok: false, error: `Unknown delivery zone: ${fulfilment.zoneId}.` };
    }
    deliveryFee = zone.fee;
  }

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const total = subtotal + Math.max(0, deliveryFee);

  const deposit = depositRequired({
    anyCakeOverThreshold,
    anyNonSimpleTier,
    total,
    depositPercent: settings.deposit_percent,
  });

  // --- date rules ---
  const dateCheck = checkDateNeeded({
    needed: payload.dateNeeded,
    now,
    minLeadDays: settings.min_lead_days,
    blocked: new Set(blockedDates),
    confirmedCountOnDate,
    dailyLimit: settings.daily_cake_limit,
  });
  if (!dateCheck.ok) {
    return { ok: false, error: dateCheck.reason ?? "That date is not available." };
  }

  return {
    ok: true,
    order: {
      customer: payload.customer,
      fulfilment: payload.fulfilment,
      dateNeeded: payload.dateNeeded,
      timeNeeded: payload.timeNeeded,
      notes: payload.notes,
      subtotal,
      deliveryFee,
      total,
      depositRequired: deposit,
      priceNeedsQuote,
      lines,
    },
  };
}
