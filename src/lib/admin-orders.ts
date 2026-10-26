import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Fulfilment, OrderStatus } from "./order-status";

/**
 * Staff-side reads of the order tables.
 *
 * Every function here takes the *cookie-aware* client, so Row Level Security
 * decides what the signed-in staff member may see — a manager never reads
 * costs, expenses or the activity log, and a customer never reads an order
 * at all.
 */

export interface AdminOrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  type: "cake" | "pastry" | "mixed";
  fulfilment: Fulfilment;
  customerName: string;
  customerPhone: string;
  total: number;
  depositRequired: number;
  amountPaid: number;
  dateNeeded: string | null;
  createdAt: string;
  itemCount: number;
  priceNeedsQuote: boolean;
}

export interface AdminOrderItem {
  id: string;
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
  allergies: string | null;
  referencePhotos: string[];
}

export interface AdminPayment {
  id: string;
  method: "mpesa" | "cash" | "bank";
  amount: number;
  referenceCode: string | null;
  paidAt: string;
  reason: string | null;
}

export interface AdminActivity {
  id: string;
  action: string;
  tableName: string | null;
  newValue: unknown;
  createdAt: string;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  subtotal: number;
  deliveryFee: number;
  deliveryAddress: string | null;
  timeNeeded: string | null;
  notes: string | null;
  items: AdminOrderItem[];
  payments: AdminPayment[];
  timeline: AdminActivity[];
}

interface OrderRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  type: "cake" | "pastry" | "mixed";
  fulfilment: Fulfilment;
  subtotal: number;
  total: number;
  deposit_required: number;
  amount_paid: number;
  delivery_fee: number;
  delivery_address: string | null;
  date_needed: string | null;
  time_needed: string | null;
  notes: string | null;
  price_needs_quote: boolean;
  created_at: string;
  customers: { name: string; phone: string } | { name: string; phone: string }[] | null;
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
          allergies: string | null;
          reference_photos: string[] | null;
        }
      | {
          size_kg: number | null;
          flavour_name: string | null;
          design_tier_name: string | null;
          design_description: string | null;
          cake_message: string | null;
          allergies: string | null;
          reference_photos: string[] | null;
        }[]
      | null;
  }[];
}

function first<T>(value: T | T[] | null): T | null {
  if (value === null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function summarise(row: OrderRow): AdminOrderSummary {
  const customer = first(row.customers);
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    type: row.type,
    fulfilment: row.fulfilment,
    customerName: customer?.name ?? "Customer",
    customerPhone: customer?.phone ?? "",
    total: row.total,
    depositRequired: row.deposit_required,
    amountPaid: row.amount_paid,
    dateNeeded: row.date_needed,
    createdAt: row.created_at,
    itemCount: (row.order_items ?? []).reduce((sum, i) => sum + i.quantity, 0),
    priceNeedsQuote: row.price_needs_quote,
  };
}

const ORDER_SELECT = `
  id, order_number, status, type, fulfilment, subtotal, total, deposit_required,
  amount_paid, delivery_fee, delivery_address, date_needed, time_needed, notes,
  price_needs_quote, created_at,
  customers(name, phone),
  order_items(id, name, quantity, unit_price, line_total, product_id,
    cake_details(size_kg, flavour_name, design_tier_name, design_description,
      cake_message, allergies, reference_photos))
`;

/** The newest orders first. */
export async function listOrders(
  supabase: SupabaseClient,
  limit = 200,
): Promise<AdminOrderSummary[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listOrders: ${error.message}`);
  return ((data ?? []) as unknown as OrderRow[]).map(summarise);
}

/** One order with its items, payments and activity trail. */
export async function getOrderDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<AdminOrderDetail | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getOrderDetail: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as OrderRow;

  const [paymentsRes, timelineRes] = await Promise.all([
    supabase
      .from("payments")
      .select("id, method, amount, reference_code, paid_at, reason")
      .eq("order_id", id)
      .order("paid_at", { ascending: false }),
    supabase
      .from("activity_log")
      .select("id, action, table_name, new_value, created_at")
      .eq("record_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const payments: AdminPayment[] = (paymentsRes.data ?? []).map((p) => ({
    id: p.id as string,
    method: p.method as AdminPayment["method"],
    amount: p.amount as number,
    referenceCode: (p.reference_code as string | null) ?? null,
    paidAt: p.paid_at as string,
    reason: (p.reason as string | null) ?? null,
  }));

  const timeline: AdminActivity[] = (timelineRes.data ?? []).map((a) => ({
    id: a.id as string,
    action: a.action as string,
    tableName: (a.table_name as string | null) ?? null,
    newValue: a.new_value,
    createdAt: a.created_at as string,
  }));

  return {
    ...summarise(row),
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    deliveryAddress: row.delivery_address,
    timeNeeded: row.time_needed,
    notes: row.notes,
    items: (row.order_items ?? []).map((item) => {
      const detail = first(item.cake_details);
      return {
        id: item.id,
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
        allergies: detail?.allergies ?? null,
        referencePhotos: detail?.reference_photos ?? [],
      };
    }),
    payments,
    timeline,
  };
}

/** The balance still owed on an order. */
export function balanceDue(order: Pick<AdminOrderSummary, "total" | "amountPaid">): number {
  return Math.max(0, order.total - order.amountPaid);
}
