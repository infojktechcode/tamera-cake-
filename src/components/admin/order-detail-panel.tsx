"use client";

import { useState } from "react";

import { StatusPill } from "@/components/admin/status-pill";
import type { AdminOrderDetail } from "@/lib/admin-orders";
import { formatKES } from "@/lib/format";
import { allowedTargets, advanceLabel, nextStatus, type OrderStatus } from "@/lib/order-status";
import type { Role } from "@/lib/permissions";
import { renderTemplate } from "@/lib/whatsapp-templates";
import { waHrefSafe } from "@/lib/whatsapp";

/**
 * The order detail (spec §6.2).
 *
 * Everything the shop needs while it works on an order: move it through the
 * status machine, take a payment, correct a quoted price, and send the
 * customer one of the shop's WhatsApp templates.
 */

interface Props {
  order: AdminOrderDetail;
  templates: Record<string, string>;
  role: Role;
}

const WHATSAPP_MENU = [
  { key: "thank_you", label: "Thank you" },
  { key: "deposit_request", label: "Ask for deposit" },
  { key: "ready_pickup", label: "Ready for pickup" },
  { key: "out_for_delivery", label: "Out for delivery" },
] as const;

export function OrderDetailPanel({ order, templates, role }: Props) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"mpesa" | "cash" | "bank">("mpesa");
  const [reference, setReference] = useState("");

  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const balance = Math.max(0, order.total - order.amountPaid);
  const targets = allowedTargets(status, { role, fulfilment: order.fulfilment });
  const next = nextStatus(status, order.fulfilment);

  const move = async (target: OrderStatus) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "That change could not be saved.");
        return;
      }
      setStatus(target);
    } catch {
      setError("We could not reach the shop server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const addPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isInteger(value) || value === 0) {
      setError("Enter the amount that was paid.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method,
          amount: value,
          referenceCode: reference.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "The payment could not be saved.");
        return;
      }
      setAmount("");
      setReference("");
      window.location.reload();
    } catch {
      setError("We could not reach the shop server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const savePrice = async (itemId: string) => {
    const value = Number(editValue);
    if (!Number.isInteger(value) || value < 0) {
      setError("Enter the new price in KES.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/price`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId, unitPrice: value }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "The price could not be saved.");
        return;
      }
      setEditing(null);
      window.location.reload();
    } catch {
      setError("We could not reach the shop server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const whatsappHref = (templateKey: string): string | null => {
    const template = templates[templateKey];
    if (!template) return null;
    const message = renderTemplate(template, {
      order: order.orderNumber,
      name: order.customerName,
      total: formatKES(order.total),
      date: order.dateNeeded ?? "to be confirmed",
      balance: formatKES(balance),
      payment: "M-Pesa paybill (see settings)",
    });
    return waHrefSafe(order.customerPhone, message);
  };

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-xl bg-strawberry/10 p-3 text-sm text-strawberry-deep">
          {error}
        </p>
      )}

      {/* --- the header --- */}
      <header className="rounded-2xl border border-cocoa/10 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">{order.orderNumber}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {order.customerName} · {order.customerPhone || "no phone"}
            </p>
            <p className="text-xs text-ink-muted">
              Placed {new Date(order.createdAt).toLocaleString("en-KE")} ·{" "}
              {order.fulfilment === "delivery" ? "Delivery" : "Pickup"}
              {order.dateNeeded ? ` · needed ${order.dateNeeded}` : ""}
            </p>
          </div>
          <div className="text-right">
            <StatusPill status={status} />
            <p className="mt-2 font-display text-xl font-bold">{formatKES(order.total)}</p>
            {balance > 0 ? (
              <p className="text-xs text-ink-muted">{formatKES(balance)} still due</p>
            ) : (
              <p className="text-xs text-pistachio">Paid in full</p>
            )}
          </div>
        </div>

        {/* --- the moves the shop can make --- */}
        <div className="mt-4 flex flex-wrap gap-2">
          {next && targets.includes(next) && (
            <button
              type="button"
              onClick={() => void move(next)}
              disabled={busy}
              className="min-h-11 rounded-full bg-strawberry px-5 py-2 text-sm font-semibold text-white transition hover:bg-strawberry-deep disabled:opacity-50"
            >
              {advanceLabel(next)}
            </button>
          )}
          {targets.includes("cancelled") && (
            <button
              type="button"
              onClick={() => void move("cancelled")}
              disabled={busy}
              className="min-h-11 rounded-full border border-cocoa/20 px-5 py-2 text-sm font-medium text-cocoa transition hover:border-cocoa/40 disabled:opacity-50"
            >
              Cancel order
            </button>
          )}
          {role !== "superadmin" && !targets.includes("cancelled") && status !== "completed" && status !== "cancelled" && (
            <p className="self-center text-xs text-ink-muted">
              Only the owner can cancel a confirmed order.
            </p>
          )}
        </div>

        {/* --- WhatsApp templates --- */}
        <div className="mt-4 border-t border-cocoa/10 pt-4">
          <h2 className="text-sm font-semibold text-cocoa">Message the customer</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {WHATSAPP_MENU.map(({ key, label }) => {
              const href = whatsappHref(key);
              if (!href) return null;
              return (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded-full border border-cocoa/20 px-4 py-2 text-sm font-medium text-cocoa transition hover:border-cocoa/40"
                >
                  {label}
                </a>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            These open WhatsApp with the message ready — press send to send it.
          </p>
        </div>
      </header>

      {/* --- the items --- */}
      <section className="rounded-2xl border border-cocoa/10 bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Items</h2>
        <ul className="mt-3 divide-y divide-cocoa/10">
          {order.items.map((item) => (
            <li key={item.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-cocoa">
                    {item.name}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </p>
                  {item.kind === "cake" && (
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {item.sizeKg ? `${item.sizeKg}kg` : ""}
                      {item.flavourName ? ` · ${item.flavourName}` : ""}
                      {item.designTierName ? ` · ${item.designTierName}` : ""}
                    </p>
                  )}
                  {item.designDescription && (
                    <p className="mt-1 text-sm text-ink-muted">{item.designDescription}</p>
                  )}
                  {item.cakeMessage && (
                    <p className="mt-1 text-sm text-cocoa">
                      Message: “{item.cakeMessage}”
                    </p>
                  )}
                  {item.allergies && (
                    <p className="mt-1 text-sm font-medium text-strawberry-deep">
                      Allergies: {item.allergies}
                    </p>
                  )}
                  {item.referencePhotos.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {item.referencePhotos.map((photo) => (
                        <li key={photo}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/cake-references/${photo}`}
                            alt="Reference photo"
                            onClick={() => setLightbox(photo)}
                            className="h-16 w-16 cursor-zoom-in rounded-lg border border-cocoa/10 object-cover"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {editing === item.id ? (
                    <>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        aria-label={`New price for ${item.name}`}
                        className="w-24 min-h-11 rounded-xl border border-cocoa/20 px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => void savePrice(item.id)}
                        disabled={busy}
                        className="min-h-11 rounded-full bg-strawberry px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="min-h-11 rounded-full border border-cocoa/20 px-3 py-1.5 text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-cocoa">
                        {formatKES(item.lineTotal)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(item.id);
                          setEditValue(String(item.unitPrice));
                        }}
                        className="min-h-11 rounded-full border border-cocoa/20 px-3 py-1.5 text-sm text-cocoa"
                      >
                        Edit price
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-1 border-t border-cocoa/10 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd>{formatKES(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Delivery</dt>
            <dd>{formatKES(order.deliveryFee)}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatKES(order.total)}</dd>
          </div>
          {order.depositRequired > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink-muted">Deposit</dt>
              <dd className="font-medium text-strawberry-deep">
                {formatKES(order.depositRequired)}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* --- payments --- */}
      <section className="rounded-2xl border border-cocoa/10 bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Payments</h2>
        {order.payments.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No payment recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-cocoa/10 text-sm">
            {order.payments.map((payment) => (
              <li key={payment.id} className="flex justify-between py-2">
                <span>
                  {payment.method === "mpesa"
                    ? "M-Pesa"
                    : payment.method === "cash"
                      ? "Cash"
                      : "Bank"}
                  {payment.referenceCode ? ` · ${payment.referenceCode}` : ""}
                </span>
                <span className={payment.amount < 0 ? "text-strawberry-deep" : ""}>
                  {formatKES(payment.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addPayment} className="mt-4 grid gap-3 sm:grid-cols-4">
          <label className="grid gap-1 text-sm font-medium text-cocoa">
            Amount
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="min-h-11 rounded-xl border border-cocoa/20 px-3 py-2 text-base font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-cocoa">
            Method
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "mpesa" | "cash" | "bank")}
              className="min-h-11 rounded-xl border border-cocoa/20 px-3 py-2 text-base font-normal"
            >
              <option value="mpesa">M-Pesa</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-cocoa">
            Reference (optional)
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="min-h-11 rounded-xl border border-cocoa/20 px-3 py-2 text-base font-normal"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="self-end min-h-11 rounded-full bg-strawberry px-5 py-2 font-semibold text-white transition hover:bg-strawberry-deep disabled:opacity-50"
          >
            Record payment
          </button>
        </form>
      </section>

      {/* --- notes --- */}
      {order.notes && (
        <section className="rounded-2xl border border-cocoa/10 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Notes from the customer</h2>
          <p className="mt-2 text-sm text-cocoa">{order.notes}</p>
        </section>
      )}

      {/* --- the activity trail --- */}
      <section className="rounded-2xl border border-cocoa/10 bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Activity</h2>
        {order.timeline.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nothing recorded yet.</p>
        ) : (
          <ol className="mt-3 space-y-2 text-sm">
            {order.timeline.map((entry) => (
              <li key={entry.id} className="flex justify-between gap-3">
                <span className="text-cocoa">{entry.action.replace(/_/g, " ")}</span>
                <span className="shrink-0 text-xs text-ink-muted">
                  {new Date(entry.createdAt).toLocaleString("en-KE")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* --- the photo lightbox --- */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-cocoa/80 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-label="Reference photo"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/cake-references/${lightbox}`}
            alt="Reference photo"
            className="max-h-full max-w-full rounded-2xl"
          />
        </div>
      )}
    </div>
  );
}
