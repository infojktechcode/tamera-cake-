"use client";

import { useState } from "react";
import Image from "next/image";
import { FadeUp, Stagger, StaggerItem } from "@/components/motion";
import { IMAGE_BLUR_DATA_URL } from "@/lib/blur";
import { useCart } from "@/lib/cart-store";
import type { PastryItem } from "@/lib/catalog";
import { formatKES } from "@/lib/format";
import { visualFor } from "@/lib/visuals";

// Soft gradient tiles that rotate by index so a monochrome emoji grid still
// feels playful (seed pastries have no photos).
const TILES = [
  "from-blush to-vanilla",
  "from-vanilla to-pistachio/40",
  "from-blush to-caramel/30",
] as const;

/**
 * Client-side pastry browsing: data-driven category chips, card grid and
 * quantity steppers that write into the shared cart.
 */
export function PastryBrowser({
  pastries,
  categories,
}: {
  pastries: PastryItem[];
  categories: string[];
}) {
  const chips = ["All", ...categories];
  const [selected, setSelected] = useState("All");
  const visible =
    selected === "All" ? pastries : pastries.filter((p) => p.category === selected);

  return (
    <div>
      <div className="mt-6 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Filter by category">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setSelected(chip)}
            aria-pressed={selected === chip}
            className={`min-h-11 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
              selected === chip
                ? "border-strawberry bg-strawberry text-white"
                : "border-cocoa/20 bg-vanilla/60 text-cocoa hover:border-cocoa/40"
            }`}
          >
            {chip}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <FadeUp>
          <p className="mt-8 text-ink-muted">Nothing in this category right now — check back soon.</p>
        </FadeUp>
      ) : (
        // key remounts the grid on chip change so the stagger replays.
        <Stagger key={selected} className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((pastry, index) => (
            <StaggerItem key={pastry.slug} className="h-full">
              <article className="flex h-full min-h-[7rem] flex-col rounded-2xl border border-cocoa/10 bg-vanilla/60 p-3">
                {pastry.image_url ? (
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                    <Image
                      src={pastry.image_url}
                      alt={pastry.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      placeholder="blur"
                      blurDataURL={IMAGE_BLUR_DATA_URL}
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div
                    aria-hidden
                    className={`flex aspect-[4/3] items-center justify-center rounded-xl bg-gradient-to-br ${TILES[index % TILES.length]}`}
                  >
                    <span className="text-5xl">{visualFor(pastry.name)}</span>
                  </div>
                )}
                <div className="flex flex-1 flex-col p-1">
                  <h2 className="line-clamp-2 text-sm font-semibold text-cocoa">{pastry.name}</h2>
                  <p className="mt-auto pt-1 text-sm font-semibold text-strawberry">
                    {formatKES(pastry.price)}
                  </p>
                  <p className="text-xs text-ink-muted">{pastry.category}</p>
                </div>
                <PastryStepper pastry={pastry} />
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

/**
 * The add / stepper controls for one pastry.
 *
 * "Add" puts one in the cart; the stepper appears once the pastry is there
 * and edits the quantity in place. Stepping down to zero removes the item.
 */
function PastryStepper({ pastry }: { pastry: PastryItem }) {
  const quantity = useCart((s) => {
    const item = s.items.find(
      (i) => i.kind === "pastry" && i.productId === pastry.id,
    );
    return item && item.kind === "pastry" ? item.quantity : 0;
  });

  const addPastry = useCart((s) => s.addPastry);
  const updatePastryQty = useCart((s) => s.updatePastryQty);

  return (
    <div className="mt-3">
      {quantity > 0 && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => updatePastryQty(pastry.id, quantity - 1)}
            aria-label={`Decrease ${pastry.name}`}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-cocoa/20 text-lg text-cocoa transition hover:border-cocoa/40"
          >
            −
          </button>
          <span
            aria-live="polite"
            aria-label={`${pastry.name} quantity`}
            className="min-w-8 text-center text-sm font-semibold text-cocoa"
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => updatePastryQty(pastry.id, quantity + 1)}
            aria-label={`Increase ${pastry.name}`}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-strawberry text-lg font-semibold text-white transition hover:bg-strawberry-deep"
          >
            +
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() =>
          addPastry({
            productId: pastry.id,
            name: pastry.name,
            unitPrice: pastry.price,
            quantity: 1,
          })
        }
        aria-label={`Add ${pastry.name}`}
        className="min-h-11 w-full rounded-full border border-strawberry px-4 py-2 text-sm font-semibold text-strawberry transition hover:bg-blush"
      >
        Add
      </button>
    </div>
  );
}
