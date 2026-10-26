"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { StatusPill } from "@/components/admin/status-pill";
import { useNewOrders } from "@/components/admin/new-orders-provider";
import { formatKES } from "@/lib/format";
import type { AdminOrderSummary } from "@/lib/admin-orders";
import {
  advanceLabel,
  allowedTargets,
  nextStatus,
  type OrderStatus,
} from "@/lib/order-status";
import type { Role } from "@/lib/permissions";
import { renderTemplate } from "@/lib/whatsapp-templates";
import { waHrefSafe } from "@/lib/whatsapp";
import { createClient } from "@/lib/supabase/browser";

/**
 * The orders board.
 *
 * A table on a desktop, a card list on a phone (spec §6.2). New orders are
 * announced in three ways: the row slides in with a highlight, the sidebar
 * badge counts up, and a short sound plays — the sound only after the shop
 * presses "Enable alerts", because browsers block audio before a gesture.
 *
 * Two ways to notice a new order:
 *   1. Supabase Realtime, which pushes inserts straight to the browser.
 *   2. A poll every 20 seconds, because the project's Supabase database has
 *      no table in its `supabase_realtime` publication yet (see
 *      docs/DECISIONS.md). The poll keeps the board honest until that is
 *      fixed, and costs one small request a minute and a bit.
 */

interface Props {
  initialOrders: AdminOrderSummary[];
  templates: Record<string, string>;
  role: Role;
}

const POLL_MS = 20_000;

type Range = "all" | "today" | "week";
type TypeFilter = "all" | "cake" | "pastry" | "mixed";

/** A short two-note chime, built in the browser so there is no asset to load. */
function playChime() {
  try {
    const Ctor = window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const now = ctx.currentTime;
    [660, 880].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.08, now + index * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + index * 0.12);
      osc.stop(now + index * 0.12 + 0.18);
    });
    setTimeout(() => void ctx.close(), 600);
  } catch {
    // Audio is a nicety — never let it break the dashboard.
  }
}

export function OrdersBoard({ initialOrders, templates, role }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | OrderStatus>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [range, setRange] = useState<Range>("all");
  const [alertsOn, setAlertsOn] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<string[]>([]);

  const { notify, clear } = useNewOrders();
  const knownIds = useRef(new Set(initialOrders.map((o) => o.id)));

  /**
   * Pull the list again (poll fallback and manual refresh).
   */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { ok: boolean; orders?: AdminOrderSummary[] };
      if (!json.ok || !json.orders) return;

      const fresh = json.orders.filter((o) => !knownIds.current.has(o.id));
      setOrders(json.orders);
      for (const order of fresh) knownIds.current.add(order.id);

      if (fresh.length > 0) {
        setFreshIds((ids) => [...ids, ...fresh.map((o) => o.id)]);
        notify();
        if (alertsOn) playChime();
      }
    } catch {
      // Offline — the next poll tries again.
    }
  }, [alertsOn, notify]);

  // --- realtime ---
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  // --- polling fallback ---
  useEffect(() => {
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    return orders.filter((order) => {
      if (status !== "all" && order.status !== status) return false;
      if (type !== "all" && order.type !== type) return false;
      if (range === "today" && order.createdAt.slice(0, 10) !== today) return false;
      if (range === "week" && order.createdAt.slice(0, 10) < weekAgo) return false;
      if (!needle) return true;
      return (
        order.orderNumber.toLowerCase().includes(needle) ||
        order.customerName.toLowerCase().includes(needle) ||
        order.customerPhone.includes(needle)
      );
    });
  }, [orders, query, status, type, range]);

  const advance = async (order: AdminOrderSummary, next: OrderStatus) => {
    setBusyId(order.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "That change could not be saved.");
        return;
      }
      setOrders((list) =>
        list.map((o) => (o.id === order.id ? { ...o, status: next } : o)),
      );
    } catch {
      setError("We could not reach the shop server. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const whatsappHref = (order: AdminOrderSummary): string | null => {
    const template = templates.thank_you ?? "";
    if (!template) return null;
    const message = renderTemplate(template, {
      order: order.orderNumber,
      name: order.customerName,
      total: formatKES(order.total),
      date: order.dateNeeded ?? "to be confirmed",
      balance: formatKES(Math.max(0, order.total - order.amountPaid)),
    });
    return waHrefSafe(order.customerPhone, message);
  };

  return (
    <div className="space-y-4">
      {/* --- the toolbar --- */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="order-search">
          Search orders
        </label>
        <input
          id="order-search"
          type="search"
          placeholder="Search name, phone or order no."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-11 flex-1 rounded-xl border border-cocoa/20 bg-white px-3 py-2 text-sm"
        />

        <label className="sr-only" htmlFor="order-status">
          Filter by status
        </label>
        <select
          id="order-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "all" | OrderStatus)}
          className="min-h-11 rounded-xl border border-cocoa/20 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="confirmed">Confirmed</option>
          <option value="deposit_paid">Deposit paid</option>
          <option value="in_production">In production</option>
          <option value="ready">Ready</option>
          <option value="out_for_delivery">Out for delivery</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <label className="sr-only" htmlFor="order-type">
          Filter by type
        </label>
        <select
          id="order-type"
          value={type}
          onChange={(e) => setType(e.target.value as TypeFilter)}
          className="min-h-11 rounded-xl border border-cocoa/20 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All types</option>
          <option value="cake">Cakes</option>
          <option value="pastry">Pastries</option>
          <option value="mixed">Mixed</option>
        </select>

        <label className="sr-only" htmlFor="order-range">
          Filter by date
        </label>
        <select
          id="order-range"
          value={range}
          onChange={(e) => setRange(e.target.value as Range)}
          className="min-h-11 rounded-xl border border-cocoa/20 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Any date</option>
          <option value="today">Today</option>
          <option value="week">Last 7 days</option>
        </select>

        <button
          type="button"
          onClick={() => setAlertsOn(true)}
          className="min-h-11 rounded-xl border border-cocoa/20 px-3 py-2 text-sm font-medium text-cocoa transition hover:border-cocoa/40"
        >
          {alertsOn ? "Alerts on" : "Enable alerts"}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-strawberry/10 p-3 text-sm text-strawberry-deep">
          {error}
        </p>
      )}

      <p className="text-sm text-ink-muted">
        {filtered.length} order{filtered.length === 1 ? "" : "s"}
      </p>

      {/* --- the list --- */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cocoa/20 bg-vanilla/40 p-10 text-center">
          <p className="text-ink-muted">
            No orders match these filters yet.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((order) => {
            const targets = allowedTargets(order.status, {
              role,
              fulfilment: order.fulfilment,
            });
            const next = nextStatus(order.status, order.fulfilment);
            const wa = whatsappHref(order);
            const isFresh = freshIds.includes(order.id);

            return (
              <li
                key={order.id}
                className={`rounded-2xl border border-cocoa/10 bg-white p-4 transition ${
                  isFresh ? "animate-[flash_1.5s_ease-out] ring-2 ring-strawberry/40" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        onClick={clear}
                        className="font-display text-base font-semibold text-cocoa underline-offset-4 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <StatusPill status={order.status} />
                      {order.priceNeedsQuote && (
                        <span className="rounded-full bg-blush px-2 py-0.5 text-xs font-medium text-cocoa">
                          Needs a quote
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-cocoa">
                      {order.customerName}
                      {order.customerPhone ? ` · ${order.customerPhone}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {order.itemCount} item{order.itemCount === 1 ? "" : "s"} ·{" "}
                      {order.fulfilment === "delivery" ? "Delivery" : "Pickup"} ·{" "}
                      {order.dateNeeded ? `needed ${order.dateNeeded}` : "no date"}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="font-display text-lg font-bold text-cocoa">
                      {formatKES(order.total)}
                    </span>
                    {order.amountPaid > 0 && (
                      <span className="text-xs text-ink-muted">
                        {formatKES(order.amountPaid)} paid
                      </span>
                    )}
                    {order.depositRequired > 0 && order.amountPaid === 0 && (
                      <span className="text-xs font-medium text-strawberry-deep">
                        {formatKES(order.depositRequired)} deposit
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {next && targets.includes(next) && (
                    <button
                      type="button"
                      onClick={() => void advance(order, next)}
                      disabled={busyId === order.id}
                      className="min-h-11 rounded-full bg-strawberry px-4 py-2 text-sm font-semibold text-white transition hover:bg-strawberry-deep disabled:opacity-50"
                    >
                      {advanceLabel(next)}
                    </button>
                  )}
                  <Link
                    href={`/admin/orders/${order.id}`}
                    onClick={clear}
                    className="inline-flex min-h-11 items-center rounded-full border border-cocoa/20 px-4 py-2 text-sm font-medium text-cocoa transition hover:border-cocoa/40"
                  >
                    Open
                  </Link>
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center rounded-full border border-cocoa/20 px-4 py-2 text-sm font-medium text-cocoa transition hover:border-cocoa/40"
                    >
                      WhatsApp
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
