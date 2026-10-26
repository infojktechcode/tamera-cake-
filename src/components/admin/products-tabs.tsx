"use client";

import { useMemo, useState } from "react";

import type { AdminFlavour, AdminProduct, AdminSize, AdminTier } from "@/lib/product-edit";

import { FlavoursPanel, SizesPanel, TiersPanel } from "./catalogue-panels";
import { ProductList } from "./product-list";

/**
 * The products screen (spec §6.2): products, cake flavours, cake sizes and
 * design tiers, each edited in place.
 *
 * The lists are held in state so a save updates the row without a round trip
 * through the server component; the server remains the source of truth on the
 * next visit.
 */

interface Props {
  products: AdminProduct[];
  flavours: AdminFlavour[];
  sizes: AdminSize[];
  tiers: AdminTier[];
  canEditPrice: boolean;
  canViewCost: boolean;
  canDelete: boolean;
}

type Tab = "products" | "flavours" | "sizes" | "tiers";
type KindFilter = "all" | "cake" | "pastry";

export function ProductsTabs({
  products: initialProducts,
  flavours: initialFlavours,
  sizes: initialSizes,
  tiers: initialTiers,
  canEditPrice,
  canViewCost,
  canDelete,
}: Props) {
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState(initialProducts);
  const [flavours, setFlavours] = useState(initialFlavours);
  const [sizes, setSizes] = useState(initialSizes);
  const [tiers, setTiers] = useState(initialTiers);

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      if (kind !== "all" && product.kind !== kind) return false;
      if (!needle) return true;
      return (
        product.name.toLowerCase().includes(needle) ||
        product.categoryName.toLowerCase().includes(needle)
      );
    });
  }, [products, query, kind]);

  const cakeCount = products.filter((product) => product.kind === "cake").length;
  const pastryCount = products.length - cakeCount;
  const hiddenCount = products.filter((product) => !product.available).length;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "products", label: "Products", count: products.length },
    { id: "flavours", label: "Flavours", count: flavours.length },
    { id: "sizes", label: "Sizes", count: sizes.length },
    { id: "tiers", label: "Tiers", count: tiers.length },
  ];

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Catalogue sections"
        className="flex flex-wrap gap-1 rounded-2xl border border-cocoa/10 bg-white p-1"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            onClick={() => setTab(item.id)}
            className={`min-h-10 flex-1 rounded-xl px-3 text-sm font-medium transition ${
              tab === item.id
                ? "bg-strawberry text-white"
                : "text-ink-muted hover:bg-vanilla hover:text-cocoa"
            }`}
          >
            {item.label}
            <span
              className={`ml-1.5 text-xs tabular-nums ${
                tab === item.id ? "text-white/80" : "text-ink-muted/70"
              }`}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {tab === "products" && (
        <section
          role="tabpanel"
          id="panel-products"
          aria-labelledby="tab-products"
          className="space-y-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative w-full sm:w-auto">
              <span className="sr-only">Search products</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products…"
                className="min-h-11 w-full rounded-full border border-cocoa/20 bg-white px-4 text-sm outline-none focus:border-strawberry sm:w-64"
              />
            </label>

            <div className="flex gap-1">
              {(
                [
                  { id: "all", label: "All", count: products.length },
                  { id: "cake", label: "Cakes", count: cakeCount },
                  { id: "pastry", label: "Pastries", count: pastryCount },
                ] as const
              ).map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={kind === filter.id}
                  onClick={() => setKind(filter.id)}
                  className={`min-h-10 rounded-full px-3 text-xs font-semibold transition ${
                    kind === filter.id
                      ? "bg-cocoa text-cream"
                      : "border border-cocoa/20 bg-white text-ink-muted hover:text-cocoa"
                  }`}
                >
                  {filter.label} {filter.count}
                </button>
              ))}
            </div>

            {hiddenCount > 0 && (
              <p className="text-xs text-ink-muted">{hiddenCount} switched off</p>
            )}
          </div>

          <p className="text-xs text-ink-muted">
            Tap a photo to replace it. Saving a price or availability updates the public shop
            immediately.
          </p>

          <ProductList
            products={visibleProducts}
            canEditPrice={canEditPrice}
            canViewCost={canViewCost}
            canDelete={canDelete}
            onSaved={(saved) =>
              setProducts((list) => list.map((item) => (item.id === saved.id ? saved : item)))
            }
            onDeleted={(id) => setProducts((list) => list.filter((item) => item.id !== id))}
          />
        </section>
      )}

      {tab === "flavours" && (
        <section
          role="tabpanel"
          id="panel-flavours"
          aria-labelledby="tab-flavours"
          className="space-y-3"
        >
          <p className="text-xs text-ink-muted">
            The flavour sets the cake&apos;s price per kilogram; switch one off when the kitchen
            runs out.
          </p>
          <FlavoursPanel
            flavours={flavours}
            canEditPrice={canEditPrice}
            onSaved={(saved) =>
              setFlavours((list) => list.map((item) => (item.id === saved.id ? saved : item)))
            }
          />
        </section>
      )}

      {tab === "sizes" && (
        <section role="tabpanel" id="panel-sizes" aria-labelledby="tab-sizes">
          <SizesPanel
            sizes={sizes}
            onSaved={(saved) =>
              setSizes((list) => list.map((item) => (item.id === saved.id ? saved : item)))
            }
          />
        </section>
      )}

      {tab === "tiers" && (
        <section
          role="tabpanel"
          id="panel-tiers"
          aria-labelledby="tab-tiers"
          className="space-y-3"
        >
          <p className="text-xs text-ink-muted">
            A design tier adds a fee to the cake; &ldquo;needs a quote&rdquo; sends the order to
            Tamera before it is priced.
          </p>
          <TiersPanel
            tiers={tiers}
            canEditPrice={canEditPrice}
            onSaved={(saved) =>
              setTiers((list) => list.map((item) => (item.id === saved.id ? saved : item)))
            }
          />
        </section>
      )}
    </div>
  );
}
