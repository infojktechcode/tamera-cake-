import { NextResponse } from "next/server";

import { extractMpesaReceipt, parseCallback } from "@/lib/mpesa";
import { mpesaCallbackLimiter } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/mpesa/callback — where Daraja reports the STK Push result.
 *
 * ⚠️ Not cryptographically authenticated: Daraja STK Push callbacks carry no
 * signature. What protects this endpoint is that (1) the CheckoutRequestID is
 * an unguessable Safaricom-generated id, (2) the database function validates
 * the received amount against the expected deposit and records mismatches as
 * failed, (3) only pending attempts can complete, and (4) an unknown
 * CheckoutRequestID changes nothing. Keep the URL secret-ish and HTTPS-only.
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
  const limit = mpesaCallbackLimiter.check(req.headers);
  if (!limit.ok) {
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Too many requests" },
      { status: 429 },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
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

  // Failure callbacks have no metadata; a success without Amount/receipt is
  // treated as missing (the database function then refuses to complete it).
  const receipt = extractMpesaReceipt(callback);

  const service = createServiceClient();
  const { data, error } = await service.rpc("process_mpesa_callback", {
    p_checkout_request_id: callback.CheckoutRequestID,
    p_merchant_request_id: callback.MerchantRequestID,
    p_result_code: callback.ResultCode,
    p_result_desc: callback.ResultDesc,
    p_mpesa_receipt_number: receipt?.mpesaReceiptNumber ?? null,
    p_amount_received: receipt?.amount ?? null,
    p_callback_payload: redactCallbackPayload(payload),
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
