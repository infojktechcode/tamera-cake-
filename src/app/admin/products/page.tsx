import { cookies } from "next/headers";

import { ProductsTabs } from "@/components/admin/products-tabs";
import { listCatalogue } from "@/lib/catalogue-admin";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Products management (spec §6.2).
 *
 * Reads with the signed-in member's own client, so the owner sees cost prices
 * and a manager never receives them at all. The role flags below only shape
 * the form; the API re-checks every permission.
 */
export const instant = false;

export default async function AdminProductsPage() {
  const user = await requireUser();
  const supabase = await createClient(await cookies());
  const catalogue = await listCatalogue(supabase, user.role);

  const canEditPrice = can(user.role, "editPrice");
  const canViewCost = can(user.role, "viewCostPrice");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Products</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Prices, stock, photos and the cake options. Changes reach the public shop as soon as
          they are saved.
        </p>
        {!canEditPrice && (
          <p className="mt-2 rounded-xl bg-vanilla px-3 py-2 text-xs text-ink-muted">
            You can edit photos, descriptions, availability and stock. Prices are the
            owner&apos;s.
          </p>
        )}
      </header>

      <ProductsTabs
        products={catalogue.products}
        flavours={catalogue.flavours}
        sizes={catalogue.sizes}
        tiers={catalogue.tiers}
        canEditPrice={canEditPrice}
        canViewCost={canViewCost}
        canDelete={can(user.role, "deleteProducts")}
      />
    </div>
  );
}
