/**
 * Notification triggers for order status changes.
 *
 * Call these from the order status transition handler (e.g. PATCH /api/admin/orders/[id])
 * to queue customer notifications when an order's status changes.
 */

import { notifyOrderStatusChange } from "./service";

/** Template names for each status transition. */
const TEMPLATE_FOR_STATUS: Record<string, string> = {
  pending_payment: "deposit_request",
  deposit_paid: "thank_you",
  in_production: "order_to_shop",
  ready: "ready_pickup",
  out_for_delivery: "out_for_delivery",
  completed: "thank_you",
  cancelled: "order_cancelled",
};

/**
 * Notify the customer when an order status changes.
 * Idempotent: duplicate calls with the same (order_id, status, channel)
 * will not create duplicate notifications.
 *
 * Safe to call even when SMS is disabled — returns gracefully.
 */
export async function notifyOnStatusChange(params: {
  orderId: string;
  newStatus: string;
  channel?: "sms" | "whatsapp";
  toPhone: string;
}): Promise<{ ok: boolean; error?: string }> {
  const channel = params.channel ?? "sms";
  const template = TEMPLATE_FOR_STATUS[params.newStatus];

  if (!template) {
    // No notification template for this status — that's OK
    return { ok: true };
  }

  const message = notificationMessageFor(template, params.newStatus);

  try {
    const result = await notifyOrderStatusChange({
      orderId: params.orderId,
      status: params.newStatus,
      channel,
      toPhone: params.toPhone,
      template,
      message,
    });
    return result;
  } catch (error) {
    return {
      ok: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Build a customer-facing message for a notification template.
 * These are templates — the admin can customize them via settings.
 */
function notificationMessageFor(template: string, status: string): string {
  const templates: Record<string, string> = {
    deposit_request: `Your order deposit is due. Please complete the M-Pesa payment to confirm your cake order (status: ${status}).`,
    thank_you: `Thank you! Your order status has been updated to ${status}.`,
    order_to_shop: `Your order is now in production (status: ${status}).`,
    ready_pickup: `Your order is ready! Status: ${status}.`,
    out_for_delivery: `Your order is out for delivery (status: ${status}).`,
    order_cancelled: `Your order has been cancelled (status: ${status}).`,
  };
  return templates[template] ?? `Your order status is now ${status}.`;
}