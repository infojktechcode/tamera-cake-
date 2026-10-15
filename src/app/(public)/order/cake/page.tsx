
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FadeUp } from "@/components/motion";
import { getFlavourCards } from "@/lib/catalog";

export const metadata: Metadata = { title: "Cake builder" };

type Props = { searchParams: Promise<{ flavour?: string }> };

export default function OrderCakePage({ searchParams }: Props) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <Suspense
        fallback={
          <>
            <h1 className="font-display text-3xl font-bold text-cocoa">Cake builder</h1>
            <p className="mt-3 text-ink-muted">Cake builder arrives in Phase 3.</p>
          </>
        }
      >
        <FlavourNotice searchParams={searchParams} />
      </Suspense>
      <Link
        href="/cakes"
        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full border border-cocoa/20 px-8 py-3 font-semibold text-cocoa transition hover:border-cocoa/40"
      >
        Back to cakes
      </Link>
    </section>
  );
}

async function FlavourNotice({ searchParams }: Props) {
  const { flavour } = await searchParams;
  const flavours = await getFlavourCards();
  const match = flavour ? flavours.find((f) => f.id === flavour) : undefined;

  return (
    <FadeUp>
      <h1 className="font-display text-3xl font-bold text-cocoa">
        {match ? `${match.name} selected` : "Cake builder"}
      </h1>
      <p className="mt-3 text-ink-muted">
        {match
          ? `${match.name} selected — the cake builder arrives in Phase 3.`
          : "Cake builder arrives in Phase 3."}
      </p>
    </FadeUp>
  );
}

