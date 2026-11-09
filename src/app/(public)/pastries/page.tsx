import type { Metadata } from "next";
import { PastryBrowser } from "@/components/public/pastries-browser";
import { FadeUp } from "@/components/motion";
import { getPastryCategories, getPastries } from "@/lib/catalog";
import { buildPageMetadata } from "@/lib/og";
import { getSiteUrl } from "@/lib/supabase/env";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "Pastries",
    description:
      "Fresh pastries daily in Kitengela, Kenya — cinnamon rolls, donuts, cookies and more. Order for pickup or delivery.",
    siteUrl: getSiteUrl(),
    path: "/pastries",
    image: "/showcase/cakes/01-classic-black-forest.jpg",
  });
}

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
