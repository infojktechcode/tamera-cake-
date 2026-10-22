"use client";

import Link from "next/link";

import { useCart } from "@/lib/cart-store";
import { formatKES } from "@/lib/format";

/**
 * The cart page.
 *
 * Cakes and pastries live in the same cart and the same order. This page is
 * the full-page view of it: the drawer is the quick glance, this is where the
 * customer checks the list before checkout.
 */
export function CartView() {
  const items = useCart((s) => s.items);
  const total = useCart((s) => s.cartTotal);
  const count = useCart((s) => s.itemCount);
  const removeItem = useCart((s) => s.removeItem);
  const updatePastryQty = useCart((s) => s.updatePastryQty);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-cocoa/10 bg-vanilla/60 p-10 text-center">
        <p aria-hidden className="text-4xl">
          🧁
        </p>
        <h2 className="mt-3 font-display text-xl font-semibold text-cocoa">
          Your cart is empty
        </h2>
        <p className="mt-1 text-ink-muted">
          Add a cake or a few pastries and we&apos;ll get baking.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/order/cake"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-strawberry px-6 py-3 font-semibold text-white transition hover:bg-strawberry-deep"
          >
            Order a cake
          </Link>
          <Link
            href="/pastries"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-cocoa/20 px-6 py-3 font-semibold text-cocoa transition hover:border-cocoa/40"
          >
            Browse pastries
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <ul className="divide-y divide-cocoa/10 rounded-2xl border border-cocoa/10 bg-vanilla/40">
        {items.map((item) => {
          const key = item.kind === "cake" ? `cake-${item.flavourId}` : item.productId;
          const removeId = item.kind === "cake" ? item.flavourId : item.productId;
          const lineTotal =
            item.kind === "cake"
              ? Math.round(item.flavourPricePerKg * item.kg + item.tierExtraFee)
              : item.unitPrice * item.quantity;

          return (
            <li key={key} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-medium text-cocoa">
                  {item.kind === "cake"
                    ? `${item.flavourName} cake — ${item.kg}kg, ${item.tierName}`
                    : item.name}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {item.kind === "cake"
                    ? "Custom cake"
                    : `${item.quantity} × ${formatKES(item.unitPrice)}`}
                </p>
                {item.kind === "cake" && item.designDescription ? (
                  <p className="mt-1 line-clamp-2 text-xs text-ink-muted">
                    {item.designDescription}
                  </p>
                ) : null}
                {item.kind === "cake" && item.referencePhotos.length > 0 ? (
                  <p className="mt-1 text-xs text-ink-muted">
                    {item.referencePhotos.length} reference photo
                    {item.referencePhotos.length > 1 ? "s" : ""}
                  </p>
                ) : null}
                {item.kind === "pastry" ? (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updatePastryQty(item.productId, item.quantity - 1)}
                      aria-label={`Decrease ${item.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-cocoa/20 text-lg text-cocoa transition hover:border-cocoa/40"
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center text-sm font-semibold text-cocoa">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updatePastryQty(item.productId, item.quantity + 1)}
                      aria-label={`Increase ${item.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-strawberry text-lg font-semibold text-white transition hover:bg-strawberry-deep"
                    >
                      +
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold text-cocoa">{formatKES(lineTotal)}</span>
                <button
                  type="button"
                  onClick={() => removeItem(removeId)}
                  aria-label={`Remove ${item.kind === "cake" ? item.flavourName : item.name}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-cocoa transition hover:bg-blush"
                >
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="h-fit rounded-2xl border border-cocoa/10 bg-vanilla/80 p-5 lg:sticky lg:top-24">
        <h2 className="font-display text-lg font-semibold text-cocoa">Your order</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {count} item{count === 1 ? "" : "s"}
        </p>
        <div className="mt-4 flex items-baseline justify-between border-t border-cocoa/10 pt-3">
          <span className="text-sm font-medium text-cocoa">Estimated total</span>
          <span className="font-display text-xl font-bold text-cocoa">
            {formatKES(total)}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          We confirm the final price on WhatsApp before you pay.
        </p>
        <Link
          href="/checkout"
          className="mt-4 flex min-h-12 w-full items-center justify-center rounded-full bg-strawberry px-6 py-3 font-semibold text-white transition hover:bg-strawberry-deep"
        >
          Checkout
        </Link>
        <Link
          href="/order/cake"
          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full border border-cocoa/20 px-6 py-3 font-semibold text-cocoa transition hover:border-cocoa/40"
        >
          Add another cake
        </Link>
      </aside>
    </div>
  );
}
