import { cookies } from "next/headers";

import { WalkInForm, type WalkInProductOption } from "@/components/admin/walk-in-form";
import { resolveProductImage } from "@/lib/product-image";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * A walk-in sale (spec §6.2).
 *
 * Reads the pastry catalogue with the signed-in member's own client.
 */
export const instant = false;

export default async function AdminWalkInPage() {
  await requireUser();
  const supabase = await createClient(await cookies());

  const { data } = await supabase
    .from("products")
    .select("id, name, price, track_stock, stock_qty, image_url, category:categories!inner(kind)")
    .eq("available", true)
    .eq("categories.kind", "pastry")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const products: WalkInProductOption[] = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    price: (row.price as number) ?? 0,
    trackStock: Boolean(row.track_stock),
    stockQty: (row.stock_qty as number) ?? 0,
    imageUrl: resolveProductImage(row.image_url as string | null),
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Walk-in</h1>
        <p className="mt-1 text-sm text-ink-muted">
          A sale at the counter. It is saved as a completed order and the stock leaves the shelf.
        </p>
      </header>

      <WalkInForm products={products} />
    </div>
  );
}
