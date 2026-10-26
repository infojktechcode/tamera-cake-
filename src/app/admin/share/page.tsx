import { cookies } from "next/headers";

import { ShareTools } from "@/components/admin/share-tools";
import { listCatalogue } from "@/lib/catalogue-admin";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/env";

export const instant = false;

export default async function SharePage() {
  const user = await requireUser();
  const supabase = await createClient(await cookies());
  const catalogue = await listCatalogue(supabase, user.role);
  const products = catalogue.products
    .filter((product) => product.available)
    .map((product) => ({
      name: product.name,
      slug: product.slug,
      kind: product.kind,
      price: product.price,
    }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Share</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Copy a product link, share it on WhatsApp or download a QR code for printing.
        </p>
      </header>
      <ShareTools products={products} siteUrl={getSiteUrl()} />
    </div>
  );
}
