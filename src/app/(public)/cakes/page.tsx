import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FadeUp, Stagger, StaggerItem } from "@/components/motion";
import { IMAGE_BLUR_DATA_URL } from "@/lib/blur";
import { getFlavourCards } from "@/lib/catalog";
import { formatKES } from "@/lib/format";
import { visualFor } from "@/lib/visuals";

export const metadata: Metadata = { title: "Cakes" };

export default async function CakesPage() {
  const flavours = await getFlavourCards();

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
      <FadeUp>
        <h1 className="font-display text-3xl font-bold text-cocoa">Our cakes</h1>
        <p className="mt-2 text-ink-muted">
          Pick a flavour and we&apos;ll bake it fresh — prices are per kilogram.
        </p>
      </FadeUp>

      {flavours.length === 0 ? (
        <FadeUp delay={0.08}>
          <p className="mt-8 text-ink-muted">Fresh bakes are on the way — check back soon.</p>
        </FadeUp>
      ) : (
        <Stagger className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {flavours.map((flavour) => (
            <StaggerItem key={flavour.id} className="h-full">
              <Link
                href={`/order/cake?flavour=${flavour.id}`}
                aria-label={`Order ${flavour.name}`}
                className="group flex h-full min-h-[7rem] flex-col rounded-2xl border border-cocoa/10 bg-vanilla/60 p-3 transition hover:shadow-md"
              >
                {flavour.image_url ? (
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                    <Image
                      src={flavour.image_url}
                      alt={flavour.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      placeholder="blur"
                      blurDataURL={IMAGE_BLUR_DATA_URL}
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div
                    aria-hidden
                    className="flex aspect-[4/3] items-center justify-center rounded-xl bg-gradient-to-br from-blush to-vanilla"
                  >
                    <span className="text-5xl transition-transform duration-300 group-hover:scale-110">
                      {visualFor(flavour.name)}
                    </span>
                  </div>
                )}
                <div className="flex flex-1 flex-col p-1">
                  <p className="line-clamp-2 text-sm font-semibold text-cocoa">{flavour.name}</p>
                  <p className="mt-auto pt-1 text-sm font-semibold text-strawberry">
                    From {formatKES(flavour.price_per_kg)}/kg
                  </p>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </section>
  );
}
