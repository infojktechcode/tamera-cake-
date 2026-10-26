import "server-only";

import { createServiceClient } from "./supabase/service";

/**
 * Read one order by its high-entropy public confirmation token.
 *
 * `orders` is RLS-locked to staff, so this narrowly scoped service-role read
 * lets customers view their confirmation without making sequential order
 * numbers usable as guessable access credentials.
 */

export interface OrderItemView {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  kind: "cake" | "pastry";
  sizeKg: number | null;
  flavourName: string | null;
  designTierName: string | null;
  designDescription: string | null;
  cakeMessage: string | null;
}

export interface OrderView {
  orderNumber: string;
  customerName: string;
  fulfilment: "pickup" | "delivery";
  deliveryAddress: string | null;
  deliveryFee: number;
  dateNeeded: string | null;
  timeNeeded: string | null;
  subtotal: number;
  total: number;
  depositRequired: number;
  priceNeedsQuote: boolean;
  status: string;
  items: OrderItemView[];
}

interface OrderRow {
  id: string;
  order_number: string;
  fulfilment: "pickup" | "delivery";
  delivery_address: string | null;
  delivery_fee: number;
  date_needed: string | null;
  time_needed: string | null;
  subtotal: number;
  total: number;
  deposit_required: number;
  price_needs_quote: boolean;
  status: string;
  customers: { name: string } | { name: string }[] | null;
  order_items: {
    id: string;
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    product_id: string | null;
    cake_details:
      | {
          size_kg: number | null;
          flavour_name: string | null;
          design_tier_name: string | null;
          design_description: string | null;
          cake_message: string | null;
        }
      | {
          size_kg: number | null;
          flavour_name: string | null;
          design_tier_name: string | null;
          design_description: string | null;
          cake_message: string | null;
        }[]
      | null;
  }[];
}

function first<T>(value: T | T[] | null): T | null {
  if (value === null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getOrderByPublicToken(
  confirmationToken: string,
): Promise<OrderView | null> {
  const service = createServiceClient();

  const { data, error } = await service
    .from("orders")
    .select(
      `id,order_number,fulfilment,delivery_address,delivery_fee,date_needed,time_needed,
       subtotal,total,deposit_required,price_needs_quote,status,
       customers(name),
       order_items(id,name,quantity,unit_price,line_total,product_id,
         cake_details(size_kg,flavour_name,design_tier_name,design_description,cake_message))`,
    )
    .eq("public_token", confirmationToken)
    .maybeSingle();

  if (error) {
    throw new Error(`getOrderByPublicToken: ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as OrderRow;
  const customer = first(row.customers);

  return {
    orderNumber: row.order_number,
    customerName: customer?.name ?? "Customer",
    fulfilment: row.fulfilment,
    deliveryAddress: row.delivery_address,
    deliveryFee: row.delivery_fee,
    dateNeeded: row.date_needed,
    timeNeeded: row.time_needed,
    subtotal: row.subtotal,
    total: row.total,
    depositRequired: row.deposit_required,
    priceNeedsQuote: row.price_needs_quote,
    status: row.status,
    items: (row.order_items ?? []).map((item) => {
      const detail = first(item.cake_details);
      return {
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        lineTotal: item.line_total,
        kind: detail ? "cake" : "pastry",
        sizeKg: detail?.size_kg ?? null,
        flavourName: detail?.flavour_name ?? null,
        designTierName: detail?.design_tier_name ?? null,
        designDescription: detail?.design_description ?? null,
        cakeMessage: detail?.cake_message ?? null,
      };
    }),
  };
}
