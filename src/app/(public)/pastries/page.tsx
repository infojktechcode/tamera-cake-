import type { Metadata } from "next";
import { PastryBrowser } from "@/components/public/pastries-browser";
import { FadeUp } from "@/components/motion";
import { getPastryCategories, getPastries } from "@/lib/catalog";

export const metadata: Metadata = { title: "Pastries" };

export default async function PastriesPage() {
  const [pastries, categories] = await Promise.all([getPastries(), getPastryCategories()]);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
      <FadeUp>
        <h1 className="font-display text-3xl font-bold text-cocoa">Pastries</h1>
        <p className="mt-2 text-ink-muted">
          Fresh from the oven daily — tap a category to browse.
        </p>
      </FadeUp>
      <PastryBrowser pastries={pastries} categories={categories} />
    </section>
  );
}
