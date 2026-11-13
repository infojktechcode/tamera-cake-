import { NextResponse } from "next/server";
import { z } from "zod";

import { RETRY_COOLDOWN_MS, retryDepositPayment } from "@/lib/mpesa/checkout";
import { mpesaRetryLimiter } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/mpesa/retry — re-send the deposit STK Push from the
 * confirmation page. The amount is always recomputed server-side from the
 * order row; only the phone number comes from the customer.
 */

const retrySchema = z.object({
  confirmation_token: z.string().uuid(),
  phone: z.string().min(1).max(20),
});

export async function POST(req: Request): Promise<NextResponse> {
  const limitResult = mpesaRetryLimiter.check(req.headers);
  const limit = limitResult instanceof Promise ? await limitResult : limitResult;
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false as const, error: "Too many attempts. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false as const, error: "Invalid request." }, { status: 400 });
  }

  const parsed = retrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: "A confirmation token and phone number are required." },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const outcome = await retryDepositPayment({
    service,
    confirmationToken: parsed.data.confirmation_token,
    phone: parsed.data.phone,
  });

  switch (outcome.status) {
    case "initiated":
    case "already_pending":
      return NextResponse.json({
        ok: true as const,
        message: "Check your phone — an M-Pesa prompt is on its way.",
      });
    case "unconfigured":
      return NextResponse.json(
        { ok: false as const, error: "M-Pesa payments are not available right now. Please pay via WhatsApp." },
        { status: 503 },
      );
    case "rejected": {
      if (outcome.notFound) {
        return NextResponse.json({ ok: false as const, error: "Order not found." }, { status: 404 });
      }
      if (outcome.retryAfterSeconds) {
        return NextResponse.json(
          { ok: false as const, error: outcome.error },
          {
            status: 429,
            headers: {
              "Retry-After": String(
                Math.min(outcome.retryAfterSeconds, Math.ceil(RETRY_COOLDOWN_MS / 1000)),
              ),
            },
          },
        );
      }
      return NextResponse.json({ ok: false as const, error: outcome.error }, { status: 400 });
    }
    case "failed":
      return NextResponse.json({ ok: false as const, error: outcome.error }, { status: 502 });
  }
}
