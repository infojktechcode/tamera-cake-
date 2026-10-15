import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FadeUp } from "@/components/motion";
import { IMAGE_BLUR_DATA_URL } from "@/lib/blur";
import { getProductBySlug, getProductSlugs } from "@/lib/catalog";
import { formatKES } from "@/lib/format";
import { buildShareMetadata } from "@/lib/og";
import { getSiteUrl } from "@/lib/supabase/env";
import { visualFor } from "@/lib/visuals";
import { getShopWhatsapp, waHref } from "@/lib/whatsapp";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await getProductSlugs();
  if (slugs.length === 0) {
    throw new Error("getProductSlugs() returned no slugs — refusing an empty sitemap.");
  }
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params; // Next 16: params is a Promise
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  return buildShareMetadata(product, getSiteUrl());
}

export default async function SharePage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const message = `Hi Tamera! I'd like to order ${product.name} — ${formatKES(product.price)}.`;
  const backHref = product.category_kind === "cake" ? "/cakes" : "/pastries";
  const backLabel = product.category_kind === "cake" ? "Back to cakes" : "Back to pastries";

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <FadeUp>
        {product.image_url ? (
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              sizes="100vw"
              placeholder="blur"
              blurDataURL={IMAGE_BLUR_DATA_URL}
              className="object-cover"
              priority
            />
          </div>
        ) : (
          <div
            aria-hidden
            className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-gradient-to-br from-blush to-vanilla"
          >
            <span className="text-7xl">{visualFor(product.name)}</span>
          </div>
        )}

        <p className="mt-6 text-xs uppercase tracking-wide text-ink-muted">
          {product.category_name}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-cocoa">{product.name}</h1>
        {product.description && <p className="mt-3 text-ink-muted">{product.description}</p>}
        <p className="mt-4 text-lg font-semibold text-strawberry">
          {formatKES(product.price)}
          {product.category_kind === "cake" ? " per kg" : ""}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href={waHref(getShopWhatsapp(), message)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#25d366] px-8 py-3 font-semibold text-cocoa transition hover:opacity-90"
          >
            Order on WhatsApp
          </a>
          <Link
            href={backHref}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-cocoa/20 px-8 py-3 font-semibold text-cocoa transition hover:border-cocoa/40"
          >
            {backLabel}
          </Link>
        </div>
      </FadeUp>
    </section>
  );
}
