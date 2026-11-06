import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FadeUp, Stagger, StaggerItem } from "@/components/motion";
import { IMAGE_BLUR_DATA_URL } from "@/lib/blur";
import { getGalleryItems } from "@/lib/catalog";
import { formatKES } from "@/lib/format";
import { buildPageMetadata } from "@/lib/og";
import { getSiteUrl } from "@/lib/supabase/env";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "Cake gallery",
    description:
      "See the celebration cakes we've baked in Kitengela, Kenya — birthdays, weddings and everyday treats, all orderable on WhatsApp.",
    siteUrl: getSiteUrl(),
    path: "/gallery",
  });
}

export default async function GalleryPage() {
  const cakes = await getGalleryItems();

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
      <FadeUp>
        <h1 className="font-display text-3xl font-bold text-cocoa">Cake gallery</h1>
        <p className="mt-2 text-ink-muted">
          A few of the cakes we&apos;ve baked — tap one to see it up close and start your order.
        </p>
      </FadeUp>

      {cakes.length === 0 ? (
        <FadeUp delay={0.08}>
          <p
            role="status"
            className="mt-8 rounded-2xl border border-cocoa/10 bg-vanilla/60 p-6 text-ink-muted"
          >
            Fresh bakes are on the way — check back soon.
          </p>
        </FadeUp>
      ) : (
        <Stagger className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cakes.map((cake) => (
            <StaggerItem key={cake.slug} className="h-full">
              <Link
                href={`/p/${cake.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-cocoa/10 bg-vanilla/60 transition hover:shadow-md"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={cake.image_url}
                    alt={cake.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    placeholder="blur"
                    blurDataURL={IMAGE_BLUR_DATA_URL}
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="line-clamp-1 font-semibold text-cocoa">{cake.name}</p>
                  {cake.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{cake.description}</p>
                  )}
                  <p className="mt-2 text-sm font-semibold text-strawberry">
                    starting {formatKES(cake.price)}
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
