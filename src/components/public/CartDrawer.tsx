"use client";

import Link from "next/link";
import { useState } from "react";

import { useCart } from "@/lib/cart-store";
import { formatKES } from "@/lib/format";

/**
 * Slide-in cart drawer.
 *
 * Reads the shared `useCart` singleton, so a cake added in the builder and a
 * pastry added on the pastries page both show up here without any prop
 * plumbing.
 */
export function CartDrawer({ depositThresholdKg }: { depositThresholdKg: number }) {
  const [open, setOpen] = useState(false);

  const items = useCart((s) => s.items);
  const total = useCart((s) => s.cartTotal);
  const count = useCart((s) => s.itemCount);
  const hasCakes = useCart((s) => s.hasCakes);
  const needsDeposit = useCart((s) =>
    s.hasCakesRequiringDeposit(depositThresholdKg),
  );
  const removeItem = useCart((s) => s.removeItem);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open cart"
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-40 flex h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-strawberry px-5 font-semibold text-white shadow-lg transition hover:bg-strawberry-deep"
      >
        <span aria-hidden>🛒</span>
        <span aria-live="polite">{count}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close cart"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-cocoa/40"
          />
          <aside
            role="dialog"
            aria-label="Your cart"
            className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-vanilla shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-cocoa/10 px-5 py-4">
              <h2 className="font-display text-lg font-bold text-cocoa">Your cart</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close cart"
                className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-cocoa transition hover:bg-blush"
              >
                ×
              </button>
            </div>

            {items.length === 0 ? (
              <p className="px-5 py-8 text-ink-muted">
                Your cart is empty — add a cake or a pastry to get started.
              </p>
            ) : (
              <ul className="flex-1 divide-y divide-cocoa/10 overflow-y-auto px-5">
                {items.map((item) => {
                  const lineTotal =
                    item.kind === "cake"
                      ? Math.round(
                          item.flavourPricePerKg * item.kg + item.tierExtraFee,
                        )
                      : item.unitPrice * item.quantity;
                  const key =
                    item.kind === "cake" ? `cake-${item.flavourId}` : item.productId;
                  const name =
                    item.kind === "cake"
                      ? `${item.flavourName} cake — ${item.kg}kg, ${item.tierName}`
                      : item.name;

                  return (
                    <li key={key} className="flex items-start justify-between gap-3 py-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-cocoa">{name}</p>
                        <p className="text-xs text-ink-muted">
                          {item.kind === "cake"
                            ? "Custom cake"
                            : `${item.quantity} × ${formatKES(item.unitPrice)}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold text-cocoa">
                          {formatKES(lineTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(key)}
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
            )}

            <div className="border-t border-cocoa/10 px-5 py-4">
              {hasCakes && needsDeposit && (
                <p className="mb-2 text-xs text-ink-muted">
                  A deposit is required for this order — we&apos;ll confirm the
                  amount at checkout.
                </p>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-cocoa">Total</span>
                <span className="font-display text-xl font-bold text-cocoa">
                  {formatKES(total)}
                </span>
              </div>
              <Link
                href="/checkout"
                onClick={() => setOpen(false)}
                className="mt-4 flex min-h-12 w-full items-center justify-center rounded-full bg-strawberry px-6 py-3 font-semibold text-white transition hover:bg-strawberry-deep"
              >
                Checkout
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
