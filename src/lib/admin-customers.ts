import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  sortCustomers,
  summariseCustomers,
  type CustomerOrderRow,
  type CustomerRow,
  type CustomerSummary,
} from "./customer-stats";

/**
 * The customer list (spec §6.2).
 *
 * A customer is a phone number: the order route upserts on it, so the same
 * person always lands on one record whether they ordered online or walked in.
 *
 * The statistics live in `customer-stats.ts` because the client table imports
 * them; this module talks to the database and must stay on the server.
 */

export type { CustomerRow, CustomerSummary };

export async function listCustomers(supabase: SupabaseClient): Promise<CustomerSummary[]> {
  const [customersRes, ordersRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, phone, notes, source, consent, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("orders").select("customer_id, total, status, created_at"),
  ]);

  if (customersRes.error) {
    throw new Error(`listCustomers/customers: ${customersRes.error.message}`);
  }
  if (ordersRes.error) {
    throw new Error(`listCustomers/orders: ${ordersRes.error.message}`);
  }

  const customers: CustomerRow[] = (customersRes.data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    phone: row.phone as string,
    notes: (row.notes as string | null) ?? null,
    source: (row.source as "online" | "walk_in") ?? "online",
    consent: Boolean(row.consent),
    createdAt: row.created_at as string,
  }));

  return sortCustomers(
    summariseCustomers(customers, (ordersRes.data ?? []) as CustomerOrderRow[]),
  );
}

/** One customer with their orders, newest first. */
export async function getCustomer(
  supabase: SupabaseClient,
  id: string,
): Promise<{
  customer: CustomerRow;
  orders: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    dateNeeded: string | null;
    createdAt: string;
  }[];
} | null> {
  const { data: row, error } = await supabase
    .from("customers")
    .select("id, name, phone, notes, source, consent, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getCustomer/customer: ${error.message}`);
  if (!row) return null;

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, order_number, status, total, date_needed, created_at")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  if (ordersError) throw new Error(`getCustomer/orders: ${ordersError.message}`);

  return {
    customer: {
      id: row.id as string,
      name: row.name as string,
      phone: row.phone as string,
      notes: (row.notes as string | null) ?? null,
      source: (row.source as "online" | "walk_in") ?? "online",
      consent: Boolean(row.consent),
      createdAt: row.created_at as string,
    },
    orders: (orders ?? []).map((o) => ({
      id: o.id as string,
      orderNumber: o.order_number as string,
      status: o.status as string,
      total: (o.total as number) ?? 0,
      dateNeeded: (o.date_needed as string | null) ?? null,
      createdAt: o.created_at as string,
    })),
  };
}
