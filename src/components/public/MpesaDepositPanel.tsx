"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { formatKES } from "@/lib/format";

/**
 * The deposit section of the confirmation page.
 *
 * Shown when a deposit is due. Polls the status endpoint while an STK push
 * may be in flight, and offers a retry form (customer re-enters their number
 * — we never echo a stored phone back into the DOM) once the attempt has
 * failed, been cancelled, or the page was opened without one.
 */

type AttemptStatus = "pending" | "completed" | "failed" | "cancelled";

interface StatusResponse {
  ok: boolean;
  status?: string;
  deposit_required?: number;
  amount_paid?: number;
  deposit_paid?: boolean;
  attempt_status?: AttemptStatus | null;
  receipt?: string | null;
  error?: string;
}

interface Props {
  token: string;
  depositRequired: number;
  /** Server-known state; refined by the first status poll. */
  depositPaid: boolean;
  orderStatus: string;
  paymentsAvailable: boolean;
  /** `?paymentIssue=1` — checkout could not start the first push. */
  paymentIssue: boolean;
}

/** One poll every 4s; stop after ~3 minutes so a lost callback cannot poll forever. */
const POLL_INTERVAL_MS = 4_000;
const MAX_POLLS = 45;

export function MpesaDepositPanel({
  token,
  depositRequired,
  depositPaid,
  orderStatus,
  paymentsAvailable,
  paymentIssue,
}: Props) {
  const router = useRouter();

  const [phase, setPhase] = useState<"waiting" | "form" | "paid">(
    depositPaid ? "paid" : orderStatus === "pending_payment" ? "waiting" : "form",
  );
  const [receipt, setReceipt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [slow, setSlow] = useState(false);

  const fetchStatus = useCallback(async (): Promise<StatusResponse | null> => {
    try {
      const res = await fetch(`/api/mpesa/status?token=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      return (await res.json()) as StatusResponse;
    } catch {
      return null; // network blip — keep polling
    }
  }, [token]);

  // One refinement pass on mount so the server-derived phase is corrected
  // (e.g. the callback landed while the page was loading).
  const refined = useRef(false);
  useEffect(() => {
    if (refined.current) return;
    refined.current = true;
    void (async () => {
      const status = await fetchStatus();
      if (!status?.ok) return;
      if (status.deposit_paid || status.attempt_status === "completed") {
        setReceipt(status.receipt ?? null);
        setPhase("paid");
      } else if (status.attempt_status === "failed" || status.attempt_status === "cancelled") {
        setPhase("form");
      }
    })();
  }, [fetchStatus]);

  // Poll while a prompt may be live.
  useEffect(() => {
    if (phase !== "waiting") return;
    let cancelled = false;
    let polls = 0;
    const interval = setInterval(() => {
      polls += 1;
      if (polls > MAX_POLLS) {
        clearInterval(interval);
        setSlow(true);
        return;
      }
      void (async () => {
        const status = await fetchStatus();
        if (cancelled || !status?.ok) return;
        if (status.deposit_paid || status.attempt_status === "completed") {
          clearInterval(interval);
          setReceipt(status.receipt ?? null);
          setPhase("paid");
          router.refresh(); // re-render the server-side status badge
        } else if (status.attempt_status === "failed" || status.attempt_status === "cancelled") {
          clearInterval(interval);
          setPhase("form");
        }
      })();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [phase, fetchStatus, router]);

  const submitRetry = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/mpesa/retry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation_token: token, phone }),
        });
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          message?: string;
        } | null;
        if (res.ok && json?.ok) {
          setPhone("");
          setSlow(false);
          setPhase("waiting");
        } else {
          setError(json?.error ?? "We could not send the M-Pesa request. Please try again.");
        }
      } catch {
        setError("We could not reach the server. Check your connection and try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, token, phone],
  );

  return (
    <section
      aria-label="M-Pesa deposit"
      className="mt-8 rounded-2xl border border-cocoa/10 bg-vanilla/60 p-5"
    >
      <h2 className="font-display text-lg font-semibold text-cocoa">Pay your deposit</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Deposit due: <span className="font-medium text-strawberry">{formatKES(depositRequired)}</span>
      </p>

      {paymentIssue && phase !== "paid" && (
        <p className="mt-3 rounded-xl bg-blush/70 p-3 text-sm text-cocoa">
          We could not start your M-Pesa payment automatically. Enter your number below and
          we will send the prompt again.
        </p>
      )}

      {phase === "paid" && (
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-cocoa">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#25d366]" aria-hidden />
          Deposit received — thank you!
          {receipt ? (
            <span className="text-ink-muted">M-Pesa receipt: {receipt}</span>
          ) : null}
        </p>
      )}

      {phase === "waiting" && (
        <div className="mt-3 text-sm text-cocoa">
          <p className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-strawberry" aria-hidden />
            Check your phone — enter your M-Pesa PIN to complete the deposit.
          </p>
          {slow && (
            <p className="mt-2 text-ink-muted">
              This is taking longer than usual. If you did not receive a prompt, send a new
              one below.
            </p>
          )}
          {slow && (
            <form onSubmit={submitRetry} className="mt-3 flex flex-col gap-3 sm:flex-row">
              <label className="flex-1">
                <span className="sr-only">Safaricom phone number</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="07XX XXX XXX"
                  className="min-h-12 w-full rounded-full border border-cocoa/20 bg-white px-4 text-sm text-cocoa placeholder:text-ink-muted/70 focus:border-strawberry focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-strawberry px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Send again"}
              </button>
            </form>
          )}
        </div>
      )}

      {phase === "form" && paymentsAvailable && (
        <form onSubmit={submitRetry} className="mt-3">
          {error && (
            <p role="alert" className="mb-3 rounded-xl bg-blush/70 p-3 text-sm text-cocoa">
              {error}
            </p>
          )}
          <p className="text-sm text-ink-muted">
            Enter the Safaricom number that should receive the M-Pesa prompt.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <label className="flex-1">
              <span className="sr-only">Safaricom phone number</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="07XX XXX XXX"
                className="min-h-12 w-full rounded-full border border-cocoa/20 bg-white px-4 text-sm text-cocoa placeholder:text-ink-muted/70 focus:border-strawberry focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-strawberry px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Send M-Pesa prompt"}
            </button>
          </div>
        </form>
      )}

      {phase === "form" && !paymentsAvailable && (
        <p className="mt-3 rounded-xl bg-blush/70 p-3 text-sm text-cocoa">
          Online payment is not available right now — we will confirm your order and arrange
          the deposit on WhatsApp.
        </p>
      )}

      {paymentsAvailable && (
        <p className="mt-3 text-xs text-ink-muted">
          You can also pay the balance later on WhatsApp when we confirm your order.
        </p>
      )}
    </section>
  );
}
