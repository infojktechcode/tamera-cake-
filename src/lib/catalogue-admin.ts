import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { can, type Role } from "./permissions";
import type { AdminFlavour, AdminProduct, AdminSize, AdminTier } from "./product-edit";

/**
 * The catalogue as the products screen sees it (spec §6.2).
 *
 * Reads run through the signed-in member's own client, so Row Level Security
 * decides what is visible: every staff member sees the products, only the
 * owner sees `product_costs`. A manager is therefore never sent a cost price
 * to hide in the browser — the database does not return it in the first place.
 */

export type { AdminFlavour, AdminProduct, AdminSize, AdminTier };

export interface AdminCatalogue {
  products: AdminProduct[];
  flavours: AdminFlavour[];
  sizes: AdminSize[];
  tiers: AdminTier[];
}

export async function listCatalogue(
  supabase: SupabaseClient,
  role: Role,
): Promise<AdminCatalogue> {
  const [productsRes, flavoursRes, sizesRes, tiersRes] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, slug, description, price, available, track_stock, stock_qty, low_stock_level, image_url, sort_order, category:categories!inner(name, kind)",
      )
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("cake_flavours")
      .select("id, name, price_per_kg, available, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("cake_sizes")
      .select("id, kg, available, sort_order")
      .order("sort_order", { ascending: true })
      .order("kg", { ascending: true }),
    supabase
      .from("design_tiers")
      .select("id, name, extra_fee, requires_quote, description, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  for (const [label, result] of [
    ["products", productsRes],
    ["cake_flavours", flavoursRes],
    ["cake_sizes", sizesRes],
    ["design_tiers", tiersRes],
  ] as const) {
    if (result.error) {
      throw new Error(`listCatalogue/${label}: ${result.error.message}`);
    }
  }

  // Managers get no rows from this table (RLS); the owner gets every cost.
  const costs = new Map<string, number>();
  if (can(role, "viewCostPrice")) {
    const { data, error } = await supabase
      .from("product_costs")
      .select("product_id, cost_price");
    if (error) throw new Error(`listCatalogue/product_costs: ${error.message}`);
    for (const row of data ?? []) {
      costs.set(row.product_id as string, row.cost_price as number);
    }
  }

  const products: AdminProduct[] = (productsRes.data ?? []).map((row) => {
    // The select-string parser cannot tell an m:1 embed from an array, so the
    // runtime object is cast back.
    const category = row.category as unknown as { name: string; kind: "cake" | "pastry" } | null;
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      description: (row.description as string | null) ?? null,
      categoryName: category?.name ?? "Uncategorised",
      kind: category?.kind ?? "pastry",
      price: (row.price as number) ?? 0,
      available: Boolean(row.available),
      trackStock: Boolean(row.track_stock),
      stockQty: (row.stock_qty as number) ?? 0,
      lowStockLevel: (row.low_stock_level as number) ?? 0,
      imageUrl: (row.image_url as string | null) ?? null,
      costPrice: costs.get(row.id as string) ?? null,
      sortOrder: (row.sort_order as number) ?? 0,
    };
  });

  const flavours: AdminFlavour[] = (flavoursRes.data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    pricePerKg: (row.price_per_kg as number) ?? 0,
    available: Boolean(row.available),
    sortOrder: (row.sort_order as number) ?? 0,
  }));

  const sizes: AdminSize[] = (sizesRes.data ?? []).map((row) => ({
    id: row.id as string,
    kg: Number(row.kg),
    available: Boolean(row.available),
    sortOrder: (row.sort_order as number) ?? 0,
  }));

  const tiers: AdminTier[] = (tiersRes.data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    extraFee: (row.extra_fee as number) ?? 0,
    requiresQuote: Boolean(row.requires_quote),
    description: (row.description as string | null) ?? null,
    sortOrder: (row.sort_order as number) ?? 0,
  }));

  return { products, flavours, sizes, tiers };
}
