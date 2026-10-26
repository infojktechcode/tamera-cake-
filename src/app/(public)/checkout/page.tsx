import type { Metadata } from "next";

import { CheckoutForm } from "@/components/public/CheckoutForm";
import { getBlockedDates, getDeliveryZones, getOrderSettings } from "@/lib/builder-data";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Review your order and tell us how you'd like it delivered.",
  alternates: { canonical: "/checkout" },
};

export default async function CheckoutPage() {
  const [zones, settings, blockedDates] = await Promise.all([
    getDeliveryZones(),
    getOrderSettings(),
    getBlockedDates(),
  ]);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
      <h1 className="font-display text-3xl font-bold text-cocoa">Checkout</h1>
      <p className="mt-2 text-ink-muted">
        Tell us who you are and how you would like your order. We will confirm the final
        amount on WhatsApp.
      </p>
      <div className="mt-8">
        <CheckoutForm
          zones={zones.map((z) => ({ id: z.id, name: z.name, fee: z.fee }))}
          settings={settings}
          blockedDates={blockedDates}
        />
      </div>
    </section>
  );
}
