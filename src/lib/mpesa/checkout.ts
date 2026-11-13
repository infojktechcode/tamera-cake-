/**
 * M-Pesa deposit orchestration (server-only).
 *
 * One place owns the "ask Daraja for an STK Push, then record it" dance so
 * the order-creation route and the retry route cannot drift apart.
 *
 * Rules this module enforces (spec / audit Phase 1):
 *   - The amount is always recomputed here from the database row
 *     (`deposit_required - amount_paid`); a client-supplied amount is never
 *     used, only the phone number.
 *   - An order is atomically claimed into `pending_payment` before the push
 *     so two identical concurrent checkouts cannot send two prompts.
 *   - A pending attempt in the last 60 s blocks a retry (the prompt may
 *     still be sitting on the customer's phone).
 *   - It never throws: Daraja and database failures come back as typed
 *     outcomes so the HTTP routes can map them without losing the order the
 *     caller may already have created.
 *   - No phone number or PIN is ever logged.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getDarajaConfig, isDarajaConfigured } from "@/lib/supabase/env";
import { initiateStkPush } from "./daraja";
import { validateMpesaPhone } from "./validation";

/** A prompt sent in the last minute may still be on the customer's phone. */
export const RETRY_COOLDOWN_MS = 60_000;

export type DepositInitiation =
  /** STK Push handed to Daraja and a pending payment attempt recorded. */
  | { status: "initiated"; checkoutRequestId: string }
  /** Daraja credentials are not set in this environment. */
  | { status: "unconfigured" }
  /** Another checkout request already claimed this order for payment. */
  | { status: "already_pending" }
  /** Refused before contacting Daraja (bad phone, nothing due, cooldown). */
  | { status: "rejected"; error: string; notFound?: boolean; retryAfterSeconds?: number }
  /** Daraja or the database failed; nothing durable was recorded. */
  | { status: "failed"; error: string };

interface OrderPaymentRow {
  id: string;
  order_number: string;
  status: string;
  deposit_required: number;
  amount_paid: number;
}

/**
 * Look up the payment-relevant columns of an order by its confirmation token.
 * Returns null when the token matches nothing.
 */
async function loadOrderForPayment(
  service: SupabaseClient,
  confirmationToken: string,
): Promise<OrderPaymentRow | null> {
  const { data, error } = await service
    .from("orders")
    .select("id, order_number, status, deposit_required, amount_paid")
    .eq("public_token", confirmationToken)
    .maybeSingle();
  if (error) {
    throw new Error(`order lookup by token: ${error.message}`);
  }
  return (data as OrderPaymentRow | null) ?? null;
}

/**
 * Validate + normalise the phone, and compute the amount still due.
 * Shared by the initial and retry paths.
 */
function prepare(
  order: OrderPaymentRow,
  phone: string,
): { ok: true; normalizedPhone: string; amount: number } | { ok: false; error: string } {
  let normalizedPhone: string;
  try {
    normalizedPhone = validateMpesaPhone(phone);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }

  const amount = order.deposit_required - order.amount_paid;
  if (order.deposit_required <= 0 || amount <= 0) {
    return { ok: false, error: "The deposit for this order has already been paid." };
  }
  if (!Number.isSafeInteger(amount) || amount < 1) {
    return { ok: false, error: "There is no deposit to pay on this order." };
  }

  return { ok: true, normalizedPhone, amount };
}

/**
 * After a successful push: point the order at this attempt and insert the
 * pending payment row. Throws on a database error (callers wrap it).
 */
async function persistAttempt(
  service: SupabaseClient,
  order: { id: string },
  push: { CheckoutRequestID: string; MerchantRequestID: string },
  normalizedPhone: string,
  amount: number,
): Promise<void> {
  const { error: updateError } = await service
    .from("orders")
    .update({
      status: "pending_payment",
      checkout_request_id: push.CheckoutRequestID,
      merchant_request_id: push.MerchantRequestID,
    })
    .eq("id", order.id);
  if (updateError) {
    throw new Error(`order ${order.id}: ${updateError.message}`);
  }

  const { error: attemptError } = await service.rpc("create_mpesa_payment_attempt", {
    p_order_id: order.id,
    p_checkout_request_id: push.CheckoutRequestID,
    p_merchant_request_id: push.MerchantRequestID,
    p_phone_number: normalizedPhone,
    p_amount: amount,
  });
  if (attemptError) {
    throw new Error(`create_mpesa_payment_attempt: ${attemptError.message}`);
  }
}

/** Roll the atomic claim back so the order does not sit in pending_payment with no attempt. */
async function releaseClaim(service: SupabaseClient, orderId: string): Promise<void> {
  try {
    await service
      .from("orders")
      .update({ status: "new" })
      .eq("id", orderId)
      .eq("status", "pending_payment")
      .is("checkout_request_id", null);
  } catch {
    // Best effort — a failed release leaves the order in pending_payment,
    // where the retry panel still lets the customer pay.
  }
}

/**
 * Kick off the first deposit attempt for an order that was just created
 * (status `new`). Used by POST /api/orders.
 */
export async function startDepositForNewOrder(params: {
  service: SupabaseClient;
  confirmationToken: string;
  phone: string;
}): Promise<DepositInitiation> {
  const { service, confirmationToken, phone } = params;

  if (!isDarajaConfigured()) {
    return { status: "unconfigured" };
  }

  try {
    const order = await loadOrderForPayment(service, confirmationToken);
    if (!order) {
      return { status: "rejected", error: "We could not find that order.", notFound: true };
    }

    const prepared = prepare(order, phone);
    if (!prepared.ok) {
      return { status: "rejected", error: prepared.error };
    }

    // Atomic claim: exactly one concurrent checkout may move the order into
    // pending_payment, so a duplicated submit cannot send two prompts.
    const { data: claimed, error: claimError } = await service
      .from("orders")
      .update({ status: "pending_payment" })
      .eq("id", order.id)
      .eq("status", "new")
      .select("id");
    if (claimError) {
      throw new Error(`claim pending_payment: ${claimError.message}`);
    }
    if (!claimed || claimed.length === 0) {
      return { status: "already_pending" };
    }

    let push;
    try {
      push = await initiateStkPush(getDarajaConfig(), {
        phoneNumber: prepared.normalizedPhone,
        amount: prepared.amount,
        accountReference: order.order_number.slice(0, 12),
        transactionDesc: `Deposit ${order.order_number}`.slice(0, 13),
      });
    } catch (error) {
      await releaseClaim(service, order.id);
      console.error(
        `[mpesa] STK push failed for order ${order.order_number}: ${(error as Error).message}`,
      );
      return {
        status: "failed",
        error: "We could not reach M-Pesa. Please try again in a moment.",
      };
    }

    try {
      await persistAttempt(service, order, push, prepared.normalizedPhone, prepared.amount);
    } catch (error) {
      await releaseClaim(service, order.id);
      // The customer may still pay the orphaned prompt; the callback will not
      // find a payment row, so keep the checkout id in the log for manual
      // reconciliation.
      console.error(
        `[mpesa] failed to record attempt for order ${order.order_number} ` +
          `(CheckoutRequestID ${push.CheckoutRequestID}): ${(error as Error).message}`,
      );
      return {
        status: "failed",
        error: "We could not record your payment request. Please try again.",
      };
    }

    return { status: "initiated", checkoutRequestId: push.CheckoutRequestID };
  } catch (error) {
    console.error(
      `[mpesa] deposit start failed for token ${confirmationToken}: ${(error as Error).message}`,
    );
    return {
      status: "failed",
      error: "We could not start your M-Pesa payment. Please try again in a moment.",
    };
  }
}

/**
 * Re-send the deposit prompt for an order the customer already sees on the
 * confirmation page. Used by POST /api/mpesa/retry.
 */
export async function retryDepositPayment(params: {
  service: SupabaseClient;
  confirmationToken: string;
  phone: string;
}): Promise<DepositInitiation> {
  const { service, confirmationToken, phone } = params;

  if (!isDarajaConfigured()) {
    return { status: "unconfigured" };
  }

  try {
    const order = await loadOrderForPayment(service, confirmationToken);
    if (!order) {
      return { status: "rejected", error: "We could not find that order.", notFound: true };
    }
    if (order.status !== "new" && order.status !== "pending_payment") {
      return {
        status: "rejected",
        error: "This order can no longer take a deposit payment. Please chat with us on WhatsApp.",
      };
    }

    const prepared = prepare(order, phone);
    if (!prepared.ok) {
      return { status: "rejected", error: prepared.error };
    }

    // Cooldown: a prompt from the last minute may still be on the phone.
    const { data: recent, error: recentError } = await service
      .from("payments")
      .select("id")
      .eq("order_id", order.id)
      .eq("payment_status", "pending")
      .gte("created_at", new Date(Date.now() - RETRY_COOLDOWN_MS).toISOString())
      .limit(1);
    if (recentError) {
      throw new Error(`pending attempt lookup: ${recentError.message}`);
    }
    if (recent && recent.length > 0) {
      return {
        status: "rejected",
        error:
          "An M-Pesa request was sent less than a minute ago. Check your phone for the prompt, or wait a moment and try again.",
        retryAfterSeconds: 60,
      };
    }

    let push;
    try {
      push = await initiateStkPush(getDarajaConfig(), {
        phoneNumber: prepared.normalizedPhone,
        amount: prepared.amount,
        accountReference: order.order_number.slice(0, 12),
        transactionDesc: `Deposit ${order.order_number}`.slice(0, 13),
      });
    } catch (error) {
      console.error(
        `[mpesa] STK push retry failed for order ${order.order_number}: ${(error as Error).message}`,
      );
      return {
        status: "failed",
        error: "We could not reach M-Pesa. Please try again in a moment.",
      };
    }

    try {
      await persistAttempt(service, order, push, prepared.normalizedPhone, prepared.amount);
    } catch (error) {
      console.error(
        `[mpesa] failed to record retry for order ${order.order_number} ` +
          `(CheckoutRequestID ${push.CheckoutRequestID}): ${(error as Error).message}`,
      );
      return {
        status: "failed",
        error: "We could not record your payment request. Please try again.",
      };
    }

    return { status: "initiated", checkoutRequestId: push.CheckoutRequestID };
  } catch (error) {
    console.error(
      `[mpesa] deposit retry failed for token ${confirmationToken}: ${(error as Error).message}`,
    );
    return {
      status: "failed",
      error: "We could not start your M-Pesa payment. Please try again in a moment.",
    };
  }
}
