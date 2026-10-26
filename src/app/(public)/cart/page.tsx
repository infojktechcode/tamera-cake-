import type { Metadata } from "next";

import { CartView } from "@/components/public/CartView";

export const metadata: Metadata = {
  title: "Your cart",
  description: "Review the cakes and pastries in your cart before checking out.",
  alternates: { canonical: "/cart" },
};

export default function CartPage() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
      <h1 className="font-display text-3xl font-bold text-cocoa">Your cart</h1>
      <p className="mt-2 text-ink-muted">
        Cakes and pastries in one order — we&apos;ll confirm the final amount on
        WhatsApp.
      </p>
      <div className="mt-8">
        <CartView />
      </div>
    </section>
  );
}
