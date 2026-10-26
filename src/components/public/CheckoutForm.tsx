"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useCart } from "@/lib/cart-store";
import { formatKES } from "@/lib/format";
import type { OrderPayload } from "@/lib/validators/order.schema";

export interface CheckoutZone {
  id: string;
  name: string;
  fee: number;
}

export interface CheckoutSettings {
  min_lead_days: number;
  daily_cake_limit: number;
  deposit_percent: number;
  deposit_threshold_kg: number;
}

const CHECKOUT_IDEMPOTENCY_STORAGE_KEY = "tamera-checkout-attempt-v1";

interface StoredCheckoutAttempt {
  fingerprint: string;
  idempotencyKey: string;
}

/**
 * The checkout form.
 *
 * The cart lives in the shared client store, but the browser never sends a
 * price: the payload carries ids, quantities and customer details only, and
 * the server recomputes every amount (spec §4 rule 1). The totals shown here
 * are for the customer's benefit — what the server charges is the truth.
 */
export function CheckoutForm({
  zones,
  settings,
  blockedDates,
}: {
  zones: CheckoutZone[];
  settings: CheckoutSettings;
  blockedDates: string[];
}) {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const details = useCart((s) => s.details);
  const clear = useCart((s) => s.clear);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfilmentKind, setFulfilmentKind] = useState<"delivery" | "pickup">(
    details.fulfilment.chosen ? details.fulfilment.kind : "delivery",
  );
  const [zoneId, setZoneId] = useState<string>(
    details.fulfilment.zoneId ?? zones[0]?.id ?? "",
  );
  const [address, setAddress] = useState("");
  // The cake builder already asked for the date and the time — start from
  // those answers instead of asking the customer again.
  const [dateNeeded, setDateNeeded] = useState(details.dateNeeded ?? "");
  const [timeNeeded, setTimeNeeded] = useState(details.timeNeeded ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => {
      if (item.kind === "cake") {
        return sum + Math.round(item.flavourPricePerKg * item.kg + item.tierExtraFee);
      }
      return sum + item.unitPrice * item.quantity;
    }, 0);
    const zone = zones.find((z) => z.id === zoneId);
    const deliveryFee = fulfilmentKind === "delivery" ? (zone?.fee ?? 0) : 0;
    const total = subtotal + deliveryFee;
    // Mirrors the server rule: a design that still needs a quote carries no
    // deposit, because there is no final price to take a percentage of yet.
    const needsDeposit = items.some(
      (item) =>
        item.kind === "cake" &&
        !item.tierRequiresQuote &&
        (item.kg >= settings.deposit_threshold_kg || item.tierName !== "Simple"),
    );
    const deposit = needsDeposit ? Math.round((total * settings.deposit_percent) / 100) : 0;
    return { subtotal, deliveryFee, total, deposit, needsDeposit };
  }, [items, zones, zoneId, fulfilmentKind, settings]);

  const blocked = blockedDates.includes(dateNeeded);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-cocoa/10 bg-vanilla/60 p-8 text-center">
        <p className="text-ink-muted">Your cart is empty.</p>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (blocked) {
      setError("That day is closed. Please pick another date.");
      return;
    }
    if (!dateNeeded) {
      setError("Please pick a date for your order.");
      return;
    }

    const orderDetails: Omit<OrderPayload, "idempotencyKey"> = {
      customer: { name: name.trim(), phone: phone.trim() },
      fulfilment:
        fulfilmentKind === "delivery"
          ? { kind: "delivery", zoneId, address: address.trim() }
          : { kind: "pickup" },
      dateNeeded,
      timeNeeded: timeNeeded || undefined,
      notes: notes.trim(),
      items: items.map((item) =>
        item.kind === "cake"
          ? {
              kind: "cake" as const,
              flavourId: item.flavourId,
              sizeId: item.sizeId,
              tierId: item.tierId,
              designDescription: item.designDescription,
              cakeMessage: item.cakeMessage,
              allergies: item.allergies,
              referencePhotos: item.referencePhotos,
            }
          : {
              kind: "pastry" as const,
              productId: item.productId,
              quantity: item.quantity,
            },
      ),
    };
    let requestKey: string;
    try {
      const fingerprintDigest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(orderDetails)),
      );
      const fingerprint = Array.from(new Uint8Array(fingerprintDigest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      let storedAttempt: StoredCheckoutAttempt | null = null;
      const storedValue = sessionStorage.getItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY);
      if (storedValue) {
        try {
          const parsed: unknown = JSON.parse(storedValue);
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            "fingerprint" in parsed &&
            typeof parsed.fingerprint === "string" &&
            "idempotencyKey" in parsed &&
            typeof parsed.idempotencyKey === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              parsed.idempotencyKey,
            )
          ) {
            storedAttempt = parsed as StoredCheckoutAttempt;
          }
        } catch {
          storedAttempt = null;
        }
      }
      requestKey =
        storedAttempt?.fingerprint === fingerprint
          ? storedAttempt.idempotencyKey
          : crypto.randomUUID();
      sessionStorage.setItem(
        CHECKOUT_IDEMPOTENCY_STORAGE_KEY,
        JSON.stringify({ fingerprint, idempotencyKey: requestKey }),
      );
    } catch {
      setError("Checkout could not safely prepare a retry. Please enable browser session storage and try again.");
      return;
    }
    const payload: OrderPayload = { ...orderDetails, idempotencyKey: requestKey };

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        ok: boolean;
        confirmation_token?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.confirmation_token) {
        setError(json.error ?? "We could not place your order. Please try again.");
        return;
      }
      sessionStorage.removeItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY);
      clear();
      router.push(`/order/${json.confirmation_token}`);
    } catch {
      setError("We could not safely complete checkout. Retrying this order will not create a duplicate.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        {/* --- your details --- */}
        <fieldset className="rounded-2xl border border-cocoa/10 bg-vanilla/60 p-5">
          <legend className="px-1 font-display text-lg font-semibold text-cocoa">
            Your details
          </legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-cocoa">
              Name
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-11 rounded-xl border border-cocoa/20 bg-white px-3 py-2 text-base font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-cocoa">
              Phone number
              <input
                type="tel"
                required
                inputMode="tel"
                placeholder="07XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="min-h-11 rounded-xl border border-cocoa/20 bg-white px-3 py-2 text-base font-normal"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Your number is used only to handle and contact you about this order.
          </p>
        </fieldset>

        {/* --- how you want it --- */}
        <fieldset className="rounded-2xl border border-cocoa/10 bg-vanilla/60 p-5">
          <legend className="px-1 font-display text-lg font-semibold text-cocoa">
            Delivery or pickup
          </legend>
          <div className="mt-3 flex gap-4">
            <label className="flex min-h-11 items-center gap-2 text-sm text-cocoa">
              <input
                type="radio"
                name="fulfilment"
                value="delivery"
                checked={fulfilmentKind === "delivery"}
                onChange={() => setFulfilmentKind("delivery")}
              />
              Delivery
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm text-cocoa">
              <input
                type="radio"
                name="fulfilment"
                value="pickup"
                checked={fulfilmentKind === "pickup"}
                onChange={() => setFulfilmentKind("pickup")}
              />
              Pickup
            </label>
          </div>

          {fulfilmentKind === "delivery" && (
            <div className="mt-4 grid gap-4">
              <label className="grid gap-1 text-sm font-medium text-cocoa">
                Delivery zone
                <select
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  className="min-h-11 rounded-xl border border-cocoa/20 bg-white px-3 py-2 text-base font-normal"
                >
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name} — {formatKES(zone.fee)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-cocoa">
                Delivery address
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="min-h-11 rounded-xl border border-cocoa/20 bg-white px-3 py-2 text-base font-normal"
                />
              </label>
            </div>
          )}
        </fieldset>

        {/* --- when --- */}
        <fieldset className="rounded-2xl border border-cocoa/10 bg-vanilla/60 p-5">
          <legend className="px-1 font-display text-lg font-semibold text-cocoa">
            When do you need it?
          </legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-cocoa">
              Date needed
              <input
                type="date"
                required
                value={dateNeeded}
                onChange={(e) => setDateNeeded(e.target.value)}
                className="min-h-11 rounded-xl border border-cocoa/20 bg-white px-3 py-2 text-base font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-cocoa">
              Time (optional)
              <input
                type="time"
                value={timeNeeded}
                onChange={(e) => setTimeNeeded(e.target.value)}
                className="min-h-11 rounded-xl border border-cocoa/20 bg-white px-3 py-2 text-base font-normal"
              />
            </label>
          </div>
          <label className="mt-4 grid gap-1 text-sm font-medium text-cocoa">
            Notes for the shop (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-xl border border-cocoa/20 bg-white px-3 py-2 text-base font-normal"
            />
          </label>
          <p className="mt-2 text-xs text-ink-muted">
            We need at least {settings.min_lead_days} days to prepare your order.
          </p>
          {blocked && (
            <p role="alert" className="mt-2 rounded-xl bg-strawberry/10 p-3 text-sm text-strawberry-deep">
              That day is closed. Please pick another date.
            </p>
          )}
        </fieldset>
      </div>

      {/* --- summary --- */}
      <aside className="h-fit rounded-2xl border border-cocoa/10 bg-vanilla/80 p-5 lg:sticky lg:top-24">
        <h2 className="font-display text-lg font-semibold text-cocoa">Your order</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.kind === "cake" ? item.flavourId : item.productId} className="flex justify-between gap-3">
              <span className="text-cocoa">
                {item.kind === "cake"
                  ? `${item.flavourName} ${item.kg}kg`
                  : `${item.name} × ${item.quantity}`}
              </span>
              <span className="font-medium text-cocoa">
                {formatKES(
                  item.kind === "cake"
                    ? Math.round(item.flavourPricePerKg * item.kg + item.tierExtraFee)
                    : item.unitPrice * item.quantity,
                )}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-1 border-t border-cocoa/10 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="text-cocoa">{formatKES(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Delivery</dt>
            <dd className="text-cocoa">{formatKES(totals.deliveryFee)}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt className="text-cocoa">Total</dt>
            <dd className="text-cocoa">{formatKES(totals.total)}</dd>
          </div>
          {totals.needsDeposit && (
            <div className="flex justify-between">
              <dt className="text-ink-muted">Deposit due now ({settings.deposit_percent}%)</dt>
              <dd className="font-medium text-strawberry">{formatKES(totals.deposit)}</dd>
            </div>
          )}
        </dl>

        {totals.needsDeposit && (
          <p className="mt-3 rounded-xl bg-blush/60 p-3 text-xs text-cocoa">
            A deposit of {formatKES(totals.deposit)} is required for this order — we will
            confirm the amount with you on WhatsApp.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-strawberry/10 p-3 text-sm text-strawberry-deep">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || blocked}
          className="mt-4 min-h-11 w-full rounded-full bg-strawberry px-5 py-3 font-semibold text-white transition hover:bg-strawberry-deep disabled:opacity-60"
        >
          {submitting ? "Placing order…" : "Place order"}
        </button>
      </aside>
    </form>
  );
}
