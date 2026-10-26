"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatKES, formatKenyanPhone } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";

/**
 * A walk-in sale (spec §6.2).
 *
 * The customer is at the counter, so the form is one thumb away from the
 * pastries: tap what they bought, take the money, save. The prices shown here
 * are for the person at the till — the server reads the catalogue again and
 * computes the total it actually saves.
 */

export interface WalkInProductOption {
  id: string;
  name: string;
  price: number;
  trackStock: boolean;
  stockQty: number;
  imageUrl: string | null;
}

interface Props {
  products: WalkInProductOption[];
}

type PaymentMethod = "cash" | "mpesa" | "bank";

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  mpesa: "M-Pesa",
  bank: "Bank",
};

export function WalkInForm({ products }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; orderNumber: string; total: number } | null>(
    null,
  );

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((p) => p.name.toLowerCase().includes(needle));
  }, [products, query]);

  const lines = useMemo(
    () =>
      products
        .filter((p) => (quantities[p.id] ?? 0) > 0)
        .map((p) => ({ product: p, quantity: quantities[p.id] })),
    [products, quantities],
  );

  const total = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  const setQuantity = (product: WalkInProductOption, next: number) => {
    setError(null);
    setSaved(null);
    setQuantities((state) => {
      const copy = { ...state };
      if (next <= 0) {
        delete copy[product.id];
      } else {
        copy[product.id] = Math.min(next, 50);
      }
      return copy;
    });
  };

  const reset = () => {
    setQuantities({});
    setName("");
    setPhone("");
    setConsent(false);
    setMethod("cash");
    setReference("");
    setNotes("");
    setError(null);
    setSaved(null);
    setQuery("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (lines.length === 0) {
      setError("Add at least one item.");
      return;
    }
    if (name.trim().length < 2) {
      setError("Enter the customer's name.");
      return;
    }
    if (!normalizePhone(phone)) {
      setError("Enter a valid Kenyan phone number.");
      return;
    }
    if (method !== "cash" && !reference.trim()) {
      setError(method === "mpesa" ? "Enter the M-Pesa code." : "Enter the bank reference.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/walk-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customer: { name: name.trim(), phone: phone.trim(), consent },
          items: lines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
          payment: { method, reference: reference.trim() || undefined },
          notes: notes.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        id?: string;
        order_number?: string;
        total?: number;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "The sale could not be saved.");
        return;
      }
      setSaved({
        id: json.id as string,
        orderNumber: json.order_number as string,
        total: json.total as number,
      });
      setQuantities({});
      setName("");
      setPhone("");
      setConsent(false);
      setReference("");
      setNotes("");
    } catch {
      setError("We could not reach the shop server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <div className="max-w-lg rounded-2xl border border-cocoa/10 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Sale saved</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">Sale complete</h2>
        <p className="mt-2 text-sm text-ink-muted">
          {todayLabel()} · {formatKES(saved.total)} taken
        </p>
        <p className="mt-1 font-display text-lg">{saved.orderNumber}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-full bg-strawberry px-5 py-2 text-sm font-semibold text-white transition hover:bg-strawberry-deep"
          >
            New sale
          </button>
          <Link
            href={`/admin/orders/${saved.id}`}
            className="inline-flex min-h-11 items-center rounded-full border border-cocoa/20 px-5 text-sm font-medium text-cocoa transition hover:border-cocoa/40"
          >
            Open the order
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <p role="alert" className="rounded-xl bg-strawberry/10 p-3 text-sm text-strawberry-deep">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* --- what they bought --- */}
        <section aria-labelledby="items-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="items-heading" className="font-display text-lg font-semibold">
              Pastries
            </h2>
            <label className="relative">
              <span className="sr-only">Search the pastries</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search…"
                className="min-h-11 w-44 rounded-full border border-cocoa/20 bg-white px-4 text-sm outline-none focus:border-strawberry"
              />
            </label>
          </div>

          {visibleProducts.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-cocoa/20 bg-white/60 p-6 text-sm text-ink-muted">
              Nothing in the catalogue matches.
            </p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {visibleProducts.map((product) => {
                const quantity = quantities[product.id] ?? 0;
                const outOfStock = product.trackStock && product.stockQty <= 0;
                return (
                  <li
                    key={product.id}
                    className={`rounded-2xl border bg-white p-3 ${
                      quantity > 0 ? "border-strawberry" : "border-cocoa/10"
                    } ${outOfStock ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blush text-xl"
                        >
                          🥐
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-cocoa">{product.name}</p>
                        <p className="text-xs text-ink-muted">
                          {formatKES(product.price)}
                          {product.trackStock
                            ? ` · ${outOfStock ? "out of stock" : `${product.stockQty} left`}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-ink-muted">
                        {quantity > 0 ? `${formatKES(product.price * quantity)}` : "\u00a0"}
                      </span>
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setQuantity(product, quantity - 1)}
                          disabled={quantity === 0}
                          aria-label={`One fewer ${product.name}`}
                          className="flex size-11 items-center justify-center rounded-full border border-cocoa/20 text-lg text-cocoa disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-semibold tabular-nums">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(product, quantity + 1)}
                          disabled={outOfStock || (product.trackStock && quantity >= product.stockQty)}
                          aria-label={`One more ${product.name}`}
                          className="flex size-11 items-center justify-center rounded-full bg-strawberry text-lg text-white disabled:opacity-30"
                        >
                          +
                        </button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* --- who and how paid --- */}
        <section className="space-y-4" aria-labelledby="customer-heading">
          <h2 id="customer-heading" className="font-display text-lg font-semibold">
            Customer
          </h2>

          <div className="space-y-3 rounded-2xl border border-cocoa/10 bg-white p-4">
            <label className="block">
              <span className="text-xs font-medium text-ink-muted">Phone</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="0712 345 678"
                className="mt-1 min-h-11 w-full rounded-xl border border-cocoa/20 px-3 text-sm outline-none focus:border-strawberry"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-muted">Name</span>
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Wanjiku Kamau"
                className="mt-1 min-h-11 w-full rounded-xl border border-cocoa/20 px-3 text-sm outline-none focus:border-strawberry"
                required
              />
            </label>
            <label className="flex items-start gap-2 text-sm text-cocoa">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-1 size-4 accent-strawberry"
              />
              <span>
                The customer agrees to WhatsApp messages about offers.
                <span className="block text-xs text-ink-muted">
                  Leave it unticked for order updates only.
                </span>
              </span>
            </label>
          </div>

          <h2 className="font-display text-lg font-semibold">Payment</h2>
          <div className="space-y-3 rounded-2xl border border-cocoa/10 bg-white p-4">
            <fieldset>
              <legend className="sr-only">Payment method</legend>
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMethod(option)}
                    aria-pressed={method === option}
                    className={`min-h-11 rounded-xl text-sm font-medium transition ${
                      method === option
                        ? "bg-strawberry text-white"
                        : "border border-cocoa/20 text-cocoa"
                    }`}
                  >
                    {PAYMENT_LABEL[option]}
                  </button>
                ))}
              </div>
            </fieldset>

            {method !== "cash" && (
              <label className="block">
                <span className="text-xs font-medium text-ink-muted">
                  {method === "mpesa" ? "M-Pesa code" : "Bank reference"}
                </span>
                <input
                  type="text"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder={method === "mpesa" ? "e.g. SGH4XY2P" : "e.g. transfer 123"}
                  className="mt-1 min-h-11 w-full rounded-xl border border-cocoa/20 px-3 text-sm outline-none focus:border-strawberry"
                />
              </label>
            )}

            <label className="block">
              <span className="text-xs font-medium text-ink-muted">Note (optional)</span>
              <input
                type="text"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="e.g. for the office"
                className="mt-1 min-h-11 w-full rounded-xl border border-cocoa/20 px-3 text-sm outline-none focus:border-strawberry"
              />
            </label>
          </div>

          <div className="rounded-2xl bg-vanilla p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink-muted">
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </span>
              <span className="font-display text-2xl font-semibold tabular-nums">
                {formatKES(total)}
              </span>
            </div>
            <button
              type="submit"
              disabled={busy || lines.length === 0}
              className="mt-3 min-h-12 w-full rounded-full bg-strawberry text-sm font-semibold text-white transition hover:bg-strawberry-deep disabled:opacity-50"
            >
              {busy ? "Saving…" : `Take ${formatKES(total)}`}
            </button>
            <button
              type="button"
              onClick={reset}
              className="mt-2 min-h-11 w-full text-sm font-medium text-ink-muted underline-offset-4 hover:underline"
            >
              Clear
            </button>
          </div>

          {phone.trim().length >= 7 && (
            <p className="text-xs text-ink-muted">
              {formatKenyanPhone(phone)} · a returning number keeps its order history.
            </p>
          )}
        </section>
      </div>
    </form>
  );
}

/** "23 Oct 2026" on the shop's clock. */
function todayLabel(): string {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());
}
