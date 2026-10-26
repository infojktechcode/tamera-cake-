import type { Metadata } from "next";
import { Suspense } from "react";

import { CakeBuilder } from "@/components/public/CakeBuilder";
import { getFlavourCards } from "@/lib/catalog";
import {
  getBlockedDates,
  getDeliveryZones,
  getDesignTiers,
  getOrderSettings,
  getSizes,
} from "@/lib/builder-data";

export const metadata: Metadata = {
  title: "Cake builder",
  description:
    "Build your own celebration cake — choose the size, flavour, design and message, then add it to your order.",
  alternates: { canonical: "/order/cake" },
};

type Props = { searchParams: Promise<{ flavour?: string }> };

export default function OrderCakePage({ searchParams }: Props) {
  return (
    <Suspense fallback={<BuilderSkeleton />}>
      <CakeBuilderRoute searchParams={searchParams} />
    </Suspense>
  );
}

/**
 * The catalogue is fetched on the server and handed to the client builder as
 * props — the builder never reaches for Supabase itself, so no anon key or
 * cache directive ships to the browser.
 */
async function CakeBuilderRoute({ searchParams }: Props) {
  const { flavour } = await searchParams;

  const [sizes, flavours, tiers, zones, blockedDates, settings] = await Promise.all([
    getSizes(),
    getFlavourCards(),
    getDesignTiers(),
    getDeliveryZones(),
    getBlockedDates(),
    getOrderSettings(),
  ]);

  return (
    <CakeBuilder
      sizes={sizes}
      flavours={flavours}
      tiers={tiers}
      zones={zones}
      blockedDates={blockedDates}
      settings={settings}
      initialFlavourId={flavour ?? null}
    />
  );
}

function BuilderSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <div className="h-9 w-64 animate-pulse rounded bg-cocoa/10" />
      <div className="mt-6 h-4 w-80 animate-pulse rounded bg-cocoa/10" />
      <div className="mt-8 h-72 animate-pulse rounded-3xl bg-cocoa/10" />
    </div>
  );
}
