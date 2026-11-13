import { NextResponse } from "next/server";

import {
  extractMpesaReceipt,
  parseCallback,
  verifyDarajaCallback,
} from "@/lib/mpesa";
import { mpesaCallbackLimiter } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/lib/database.types";

/**
 * POST /api/mpesa/callback — where Daraja reports the STK Push result.
 *
 * Security: This endpoint now implements multi-layer callback verification:
 * 1. Structure validation - validates callback has required fields and types
 * 2. HMAC-SHA256 verification (optional, for C2B) - verifies signature header
 * 3. STK Push Query verification (optional) - independently queries Safaricom
 *    for transaction status using CheckoutRequestID
 *
 * Response contract: Daraja expects 200 with `ResultCode: 0` to stop
 * retrying. Anything else is retried, so only genuine database failures
 * return non-2xx.
 */

/** Drop phone numbers from the stored payload; the payments row keeps what we need. */
function redactCallbackPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  try {
    const clone = JSON.parse(JSON.stringify(payload)) as {
      Body?: {
        stkCallback?: {
          CallbackMetadata?: { Item?: Array<{ Name: string; Value: unknown }> };
        };
      };
    };
    const items = clone.Body?.stkCallback?.CallbackMetadata?.Item;
    if (items) {
      for (const item of items) {
        if (item.Name === "PhoneNumber") item.Value = "[redacted]";
      }
    }
    return clone;
  } catch {
    return null;
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const limitResult = mpesaCallbackLimiter.check(req.headers);
  const limit = limitResult instanceof Promise ? await limitResult : limitResult;
  if (!limit.ok) {
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Too many requests" },
      { status: 429 },
    );
  }

  // Get raw body for HMAC verification
  const rawBody = await req.text();

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Invalid payload" },
      { status: 400 },
    );
  }

  let callback;
  try {
    callback = parseCallback(payload);
  } catch (error) {
    // A malformed callback can never succeed on retry — acknowledge so Daraja
    // stops sending it, and log without the payload (it may contain PII).
    console.warn(`[mpesa] malformed callback rejected: ${(error as Error).message}`);
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Malformed callback" });
  }

  // Perform cryptographic verification of the callback
  const signatureHeader = req.headers.get('x-signature') ?? req.headers.get('x-mpesa-signature') ?? undefined;

  const verification = await verifyDarajaCallback(
    callback,
    rawBody,
    signatureHeader
  );

  if (!verification.verified) {
    console.warn(
      `[mpesa] callback verification failed for ${callback.CheckoutRequestID}: ${verification.reason}`
    );
    // Return 200 with ResultCode 1 to stop Daraja retries for invalid callbacks
    // but log the failure for monitoring
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Callback verification failed" });
  }

  // Log verification methods used for audit trail
  console.info(
    `[mpesa] callback verified for ${callback.CheckoutRequestID}: ` +
      `structure=${verification.methods.structure}, ` +
      `hmac=${verification.methods.hmac}, ` +
      `stkQuery=${verification.methods.stkQuery}`
  );

  // Failure callbacks have no metadata; a success without Amount/receipt is
  // treated as missing (the database function then refuses to complete it).
  const receipt = extractMpesaReceipt(callback);

  const service = createServiceClient();
  const { data, error } = await service.rpc("process_mpesa_callback", {
    p_checkout_request_id: callback.CheckoutRequestID,
    p_merchant_request_id: callback.MerchantRequestID,
    p_result_code: callback.ResultCode,
    p_result_desc: callback.ResultDesc,
    p_mpesa_receipt_number: receipt?.mpesaReceiptNumber ?? "",
    p_amount_received: receipt?.amount ?? 0,
    p_callback_payload: redactCallbackPayload(payload) as Json,
  });

  if (error) {
    // Transient database failure: non-2xx so Daraja retries.
    console.error(
      `[mpesa] process_mpesa_callback failed for ${callback.CheckoutRequestID}: ${error.message}`,
    );
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Processing error" },
      { status: 500 },
    );
  }

  const result = data as { ok?: boolean } | null;
  if (result && result.ok === false) {
    // Unknown CheckoutRequestID: nothing to update. Acknowledge anyway — a
    // retry can never find the payment, and we must not leave Daraja retrying.
    console.warn(`[mpesa] callback for unknown CheckoutRequestID ${callback.CheckoutRequestID}`);
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Unknown CheckoutRequestID" });
  }

  // Fresh or duplicate: Daraja only needs ResultCode 0 to stop retrying.
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
