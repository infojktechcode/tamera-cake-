import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Confetti } from "@/components/public/Confetti";
import { FadeUp } from "@/components/motion";
import { formatKES } from "@/lib/format";
import { getMessageTemplates } from "@/lib/message-templates";
import { getOrderByPublicToken } from "@/lib/order-lookup";
import { getShopWhatsapp, waHref } from "@/lib/whatsapp";
import { renderTemplate } from "@/lib/whatsapp-templates";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Order confirmation",
    description: "Your order confirmation at Tamera's Cakes & Bakery.",
    robots: { index: false, follow: false },
  };
}

/**
 * The random token in the confirmation URL prevents order-number enumeration.
 */
export default function OrderConfirmationPage({ params }: Props) {
  return (
    <section className="relative mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <Confetti />
      <Suspense fallback={<ConfirmationSkeleton />}>
        <OrderConfirmation tokenPromise={params} />
      </Suspense>
    </section>
  );
}

async function OrderConfirmation({ tokenPromise }: { tokenPromise: Props["params"] }) {
  const { token } = await tokenPromise;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    notFound();
  }
  const [order, templates] = await Promise.all([
    getOrderByPublicToken(token),
    getMessageTemplates(),
  ]);

  if (!order) notFound();

  const dateLabel = order.dateNeeded
    ? new Intl.DateTimeFormat("en-KE", {
        timeZone: "Africa/Nairobi",
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(order.dateNeeded))
    : "To be confirmed";

  const message = renderTemplate(templates.order_to_shop, {
    order: order.orderNumber,
    name: order.customerName,
    total: formatKES(order.total),
    date: dateLabel,
  });

  const day = order.dateNeeded?.replace(/-/g, "") ?? null;
  const calendarHref = day
    ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        `Tamera's order ${order.orderNumber}`,
      )}&dates=${day}/${day}&details=${encodeURIComponent(
        message,
      )}&location=${encodeURIComponent(order.deliveryAddress ?? "Tamera's Cakes & Bakery")}`
    : null;

  return (
    <FadeUp>
      <div className="text-center">
        <p className="text-sm uppercase tracking-wide text-ink-muted">Order received</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-cocoa sm:text-4xl">
          {order.orderNumber}
        </h1>
        <p className="mt-3 text-ink-muted">
          Thank you, {order.customerName} — we have your order and will be in touch on
          WhatsApp.
        </p>
      </div>

      {order.priceNeedsQuote && (
        <p className="mt-6 rounded-2xl bg-blush/70 p-4 text-center text-sm text-cocoa">
          Your design needs a quote before we can confirm the final price. We will send you
          the details on WhatsApp.
        </p>
      )}

      <div className="mt-8 rounded-2xl border border-cocoa/10 bg-vanilla/60 p-5">
        <h2 className="font-display text-lg font-semibold text-cocoa">Your order</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="text-cocoa">
                {item.name}
                {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                {item.designTierName ? (
                  <span className="text-ink-muted"> ({item.designTierName})</span>
                ) : null}
              </span>
              <span className="font-medium text-cocoa">{formatKES(item.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-1 border-t border-cocoa/10 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="text-cocoa">{formatKES(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">
              {order.fulfilment === "delivery" ? "Delivery" : "Pickup"}
            </dt>
            <dd className="text-cocoa">{formatKES(order.deliveryFee)}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt className="text-cocoa">Total</dt>
            <dd className="text-cocoa">{formatKES(order.total)}</dd>
          </div>
          {order.depositRequired > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink-muted">Deposit to pay</dt>
              <dd className="font-medium text-strawberry">
                {formatKES(order.depositRequired)}
              </dd>
            </div>
          )}
        </dl>

        <dl className="mt-4 grid gap-1 border-t border-cocoa/10 pt-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Needed on</dt>
            <dd className="text-cocoa">
              {dateLabel}
              {order.timeNeeded ? ` at ${order.timeNeeded.slice(0, 5)}` : ""}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">
              {order.fulfilment === "delivery" ? "Delivering to" : "Collecting from"}
            </dt>
            <dd className="text-right text-cocoa">
              {order.deliveryAddress ?? "Tamera's Cakes & Bakery"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <a
          href={waHref(getShopWhatsapp(), message)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-[#25d366] px-8 py-3 font-semibold text-cocoa transition hover:opacity-90"
        >
          Send order on WhatsApp
        </a>
        {calendarHref && (
          <a
            href={calendarHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-cocoa/20 px-8 py-3 font-semibold text-cocoa transition hover:border-cocoa/40"
          >
            Add to calendar
          </a>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Opening WhatsApp opens a chat with your message ready — press send to send it.
      </p>

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="text-sm font-medium text-strawberry underline underline-offset-4"
        >
          Back to the shop
        </Link>
      </div>
    </FadeUp>
  );
}

function ConfirmationSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mx-auto h-8 w-48 animate-pulse rounded bg-cocoa/10" />
      <div className="mt-4 h-4 w-72 animate-pulse rounded bg-cocoa/10" />
      <div className="mt-8 h-64 animate-pulse rounded-2xl bg-cocoa/10" />
    </div>
  );
}
