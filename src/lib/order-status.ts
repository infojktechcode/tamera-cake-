import type { Role } from "./permissions";

/**
 * The order status machine (spec §5).
 *
 * A new order walks the chain
 *
 *   new → confirmed → deposit_paid → in_production → ready → out_for_delivery → completed
 *
 * and a pickup order skips `out_for_delivery` (there is nothing to deliver).
 * `cancelled` is reachable from every state before `completed`.
 *
 * The rules live here, pure and tested, because they are enforced in two
 * places: the dashboard (which only offers the moves that are allowed) and
 * the API route (which refuses the moves that are not).
 */

export const ORDER_STATUSES = [
  "new",
  "pending_payment",
  "confirmed",
  "deposit_paid",
  "in_production",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Fulfilment = "pickup" | "delivery";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New",
  pending_payment: "Pending payment",
  confirmed: "Confirmed",
  deposit_paid: "Deposit paid",
  in_production: "In production",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Status colours from the design system (spec §7.1). */
export const STATUS_TONE: Record<OrderStatus, string> = {
  new: "bg-strawberry/15 text-strawberry-deep ring-strawberry/30",
  pending_payment: "bg-amber-100 text-amber-800 ring-amber-200",
  confirmed: "bg-caramel/20 text-[#8a5a17] ring-caramel/40",
  deposit_paid: "bg-slate-200 text-slate-700 ring-slate-300",
  in_production: "bg-purple-100 text-purple-800 ring-purple-200",
  ready: "bg-pistachio/30 text-[#2f6b45] ring-pistachio/50",
  out_for_delivery: "bg-teal-100 text-teal-800 ring-teal-200",
  completed: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  cancelled: "bg-cocoa/10 text-ink-muted ring-cocoa/20",
};

/** The happy path, in order. */
const FLOW: OrderStatus[] = [
  "new",
  "confirmed",
  "deposit_paid",
  "in_production",
  "ready",
  "out_for_delivery",
  "completed",
];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

/** An order that still needs the shop's attention. */
export function isOpen(status: OrderStatus): boolean {
  return status !== "completed" && status !== "cancelled";
}

/**
 * The status a quick-advance button moves to, or null when there is nothing
 * left to advance to.
 */
export function nextStatus(from: OrderStatus, fulfilment: Fulfilment): OrderStatus | null {
  if (from === "cancelled" || from === "completed") return null;
  const index = FLOW.indexOf(from);
  if (index < 0) return null;
  let next = FLOW[index + 1];
  if (!next) return null;
  // A pickup order has no delivery leg.
  if (next === "out_for_delivery" && fulfilment === "pickup") next = "completed";
  return next;
}

export interface TransitionContext {
  role: Role;
  fulfilment: Fulfilment;
}

export interface TransitionResult {
  ok: boolean;
  reason?: string;
}

/**
 * Can this order move to `to`?
 *
 * Cancellation rules (spec §5): a manager may cancel an order that has not
 * been confirmed yet; once the shop has confirmed it, only the owner
 * (superadmin) can cancel it.
 *
 * `pending_payment` is a transient state: an order moves into it when an
 * M-Pesa STK Push is initiated, and out of it when the payment callback
 * arrives (to `deposit_paid` on success, back to `new` on failure).
 */
export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  ctx: TransitionContext,
): TransitionResult {
  if (from === to) return { ok: false, reason: "The order is already in that state." };
  if (from === "completed") return { ok: false, reason: "A completed order cannot change." };

  // Pending-payment transitions (STK push lifecycle).
  if (from === "pending_payment") {
    if (to === "deposit_paid") return { ok: true }; // Payment callback succeeded.
    if (to === "new") return { ok: true }; // Payment failed or expired — retry.
    if (to === "cancelled") {
      if (ctx.role === "superadmin") return { ok: true };
      return { ok: false, reason: "Only the owner can cancel a pending-payment order." };
    }
    return { ok: false, reason: "A pending-payment order can only move to deposit paid or new." };
  }
  if (to === "pending_payment") {
    if (from === "new") return { ok: true }; // STK push initiated.
    return { ok: false, reason: "Only a new order can enter pending payment." };
  }

  if (to === "cancelled") {
    if (from === "new") return { ok: true };
    if (ctx.role === "superadmin") return { ok: true };
    return {
      ok: false,
      reason:
        "Only the owner can cancel a confirmed order. Ask Tamera's owner to cancel it.",
    };
  }

  const fromIndex = FLOW.indexOf(from);
  const toIndex = FLOW.indexOf(to);
  if (fromIndex < 0 || toIndex < 0) {
    return { ok: false, reason: "That is not a valid status." };
  }
  if (toIndex !== fromIndex + 1) {
    return { ok: false, reason: "An order can only move one step at a time." };
  }
  if (to === "out_for_delivery" && ctx.fulfilment === "pickup") {
    return { ok: false, reason: "A pickup order is not delivered." };
  }
  return { ok: true };
}

/**
 * Every status this order may move to right now.
 *
 * Used by the dashboard to build the buttons — the API re-checks the same
 * rules, so a hand-crafted request cannot do more than the UI offers.
 *
 * A pending-payment order gets its own set: staff can manually record the
 * deposit when a callback never arrives ("Mark deposit paid"), or send the
 * order back to new when the customer abandons the prompt.
 */
export function allowedTargets(from: OrderStatus, ctx: TransitionContext): OrderStatus[] {
  if (from === "pending_payment") {
    const targets: OrderStatus[] = [];
    if (canTransition(from, "deposit_paid", ctx).ok) targets.push("deposit_paid");
    if (canTransition(from, "new", ctx).ok) targets.push("new");
    if (canTransition(from, "cancelled", ctx).ok) targets.push("cancelled");
    return targets;
  }
  const next = nextStatus(from, ctx.fulfilment);
  const targets: OrderStatus[] = [];
  if (next && canTransition(from, next, ctx).ok) targets.push(next);
  if (from !== "completed" && from !== "cancelled" && canTransition(from, "cancelled", ctx).ok) {
    targets.push("cancelled");
  }
  return targets;
}

/** The label of the quick-advance button. */
export function advanceLabel(to: OrderStatus): string {
  switch (to) {
    case "confirmed":
      return "Confirm";
    case "deposit_paid":
      return "Mark deposit paid";
    case "in_production":
      return "Start production";
    case "ready":
      return "Mark ready";
    case "out_for_delivery":
      return "Send out for delivery";
    case "completed":
      return "Complete";
    case "new":
      // Only offered from pending_payment: give up on the STK push.
      return "Abandon payment";
    default:
      return STATUS_LABEL[to];
  }
}
