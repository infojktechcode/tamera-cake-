import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FadeUp, Floating, Stagger, StaggerItem } from "@/components/motion";
import { HeroImage } from "@/components/public/hero";
import { IMAGE_BLUR_DATA_URL } from "@/lib/blur";
import { getFeaturedCakes, getPublicSettings } from "@/lib/catalog";
import { formatKES } from "@/lib/format";
import { buildPageMetadata } from "@/lib/og";
import {
  buildOpeningHoursJsonLd,
  formatOpeningHours,
  resolveFaq,
  resolvePolicyLinks,
  resolveSocialLinks,
} from "@/lib/public-content";
import { getSiteUrl } from "@/lib/supabase/env";
import { getShopWhatsapp, waHref } from "@/lib/whatsapp";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "Fresh cakes, pastries and custom bakes in Kitengela",
    description:
      "Order cakes and pastries in Kitengela, Kenya. Custom celebration cakes, same-day pastries, pickup and delivery options, and a simple deposit-based ordering flow.",
    siteUrl: getSiteUrl(),
    path: "/",
    image: "/showcase/cakes/01-classic-black-forest.jpg",
  });
}

const STEPS = [
  "Pick your cake or pastry",
  "Send your order on WhatsApp",
  "Confirm with a deposit — collect or get it delivered",
] as const;

// Decorative sprinkles: positions are percentages so they read the same on a
// 360px phone and a desktop. Color variety comes from the brand tokens.
const SPRINKLES = [
  { className: "left-[8%] top-[16%]", color: "bg-strawberry", size: "h-3 w-3", duration: 5 },
  { className: "right-[14%] top-[24%]", color: "bg-caramel", size: "h-2.5 w-2.5", duration: 7 },
  { className: "left-[18%] bottom-[20%]", color: "bg-pistachio", size: "h-3.5 w-3.5", duration: 6 },
  { className: "right-[10%] bottom-[28%]", color: "bg-strawberry-deep", size: "h-2 w-2", duration: 8 },
  { className: "left-[46%] top-[8%]", color: "bg-caramel", size: "h-2 w-2", duration: 6.5 },
] as const;

export default async function HomePage() {
  const [settings, featured] = await Promise.all([
    getPublicSettings(),
    getFeaturedCakes(4),
  ]);
  const address = settings.address ?? "Kitengela, Nairobi";
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const faq = resolveFaq(settings.faq_items);
  const socialLinks = resolveSocialLinks(settings.social_links);
  const policyLinks = resolvePolicyLinks(settings);
  const businessJsonLd = {
    "@context": "https://schema.org",
    "@type": "Bakery",
    name: "Tamera's Cakes & Bakery",
    telephone: getShopWhatsapp(),
    address: {
      "@type": "PostalAddress",
      streetAddress: address,
      addressLocality: "Kitengela",
      addressRegion: "Nairobi County",
      addressCountry: "KE",
    },
    ...buildOpeningHoursJsonLd(settings.opening_hours),
    priceRange: "KES 500-KES 8000",
    url: "https://tameras-cakes.vercel.app",
    description:
      "Fresh cakes, pastries and custom celebration bakes in Kitengela, Kenya.",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
      />
      {/* 1 — Hero: headline, sprinkles, parallax image, two large choices. */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blush/40 to-cream">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {SPRINKLES.map((sprinkle) => (
            <Floating
              key={`${sprinkle.className}-${sprinkle.color}`}
              duration={sprinkle.duration}
              className={`absolute ${sprinkle.className}`}
            >
              <span className={`block rounded-full opacity-70 ${sprinkle.size} ${sprinkle.color}`} />
            </Floating>
          ))}
        </div>

        <div className="relative z-10 mx-auto grid w-full max-w-5xl gap-8 px-4 py-12 sm:grid-cols-2 sm:items-center sm:py-16">
          <div>
            <FadeUp>
              <h1 className="font-display text-4xl font-bold leading-tight text-cocoa sm:text-5xl">
                Cakes and pastries made with love in Kitengela.
              </h1>
            </FadeUp>
            <FadeUp delay={0.08}>
              <p className="mt-4 text-lg text-ink-muted">
                Fresh bakes for birthdays, weddings and everyday cravings — pick your
                favourite and order right here on WhatsApp.
              </p>
            </FadeUp>
            <FadeUp delay={0.16}>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/cakes"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-strawberry px-6 py-3 font-semibold text-white transition hover:bg-strawberry-deep"
                >
                  Order a cake
                </Link>
                <Link
                  href="/pastries"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-caramel px-6 py-3 font-semibold text-white transition hover:opacity-90"
                >
                  Order pastries
                </Link>
              </div>
            </FadeUp>
          </div>
          <HeroImage />
        </div>
      </section>

      {/* 2 — Featured cakes. */}
      <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
        <FadeUp>
          <h2 className="font-display text-2xl font-bold text-cocoa sm:text-3xl">
            Featured cakes
          </h2>
          <p className="mt-2 text-ink-muted">Tap a cake to see it up close.</p>
        </FadeUp>
        {featured.length === 0 ? (
          <p className="mt-6 text-ink-muted">Fresh bakes are on the way — check back soon.</p>
        ) : (
          <Stagger className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {featured.map((cake) => (
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
                      sizes="(max-width: 768px) 50vw, 25vw"
                      placeholder="blur"
                      blurDataURL={IMAGE_BLUR_DATA_URL}
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <p className="line-clamp-2 text-sm font-semibold text-cocoa">{cake.name}</p>
                    <p className="mt-1 text-xs text-ink-muted">starting {formatKES(cake.price)}</p>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>

      {/* 3 — How it works. */}
      <section className="bg-vanilla/60 py-12 sm:py-16">
        <div className="mx-auto w-full max-w-5xl px-4">
          <FadeUp>
            <h2 className="font-display text-2xl font-bold text-cocoa sm:text-3xl">
              How it works
            </h2>
          </FadeUp>
          <ol role="list" className="mt-6 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step}>
                <FadeUp
                  delay={index * 0.1}
                  className="h-full rounded-2xl border border-cocoa/10 bg-cream p-5"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-strawberry text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="mt-3 font-medium text-cocoa">{step}</p>
                </FadeUp>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4 — Location. */}
      <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
        <FadeUp>
          <div className="rounded-3xl border border-cocoa/10 bg-blush/40 p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-cocoa">Find us</h2>
            <p className="mt-2 text-ink-muted">{address}</p>
            <a
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-caramel px-6 py-3 font-semibold text-white transition hover:opacity-90"
            >
              Open in Google Maps
            </a>
          </div>
        </FadeUp>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
        <FadeUp>
          <div className="grid gap-6 rounded-3xl border border-cocoa/10 bg-vanilla/70 p-6 sm:grid-cols-2 sm:p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">Visit us</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-cocoa">Cake pickup and delivery</h2>
              <p className="mt-3 text-ink-muted">{address}</p>
              <p className="mt-2 text-sm text-cocoa">
                Call or WhatsApp us on <a href={waHref(getShopWhatsapp(), "Hi Tamera! I'd like to order.")}>{getShopWhatsapp()}</a>.
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">Opening hours</p>
              <p className="mt-2 text-ink-muted">{formatOpeningHours(settings.opening_hours)}</p>
              <p className="mt-4 text-sm text-cocoa">Deposits secure your order, and changes/cancellations are subject to our bakery policy.</p>
              {policyLinks.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {policyLinks.map((policy) => (
                    <li key={policy.key}>
                      <Link
                        href={policy.href}
                        className="text-strawberry underline-offset-2 hover:underline"
                      >
                        {policy.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </FadeUp>
      </section>

      {socialLinks.length > 0 && (
        <section className="mx-auto w-full max-w-5xl px-4 pb-4">
          <FadeUp>
            <h2 className="sr-only">Follow us</h2>
            <ul className="flex flex-wrap justify-center gap-3">
              {socialLinks.map((social) => (
                <li key={social.key}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center rounded-full border border-cocoa/10 bg-vanilla/70 px-4 py-2 text-sm font-medium text-cocoa transition hover:bg-vanilla"
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          </FadeUp>
        </section>
      )}

      <section className="bg-blush/50 py-12 sm:py-16">
        <div className="mx-auto w-full max-w-5xl px-4">
          <FadeUp>
            <h2 className="font-display text-2xl font-bold text-cocoa sm:text-3xl">FAQs</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {faq.map((item) => (
                <div
                  key={item.question}
                  className="rounded-2xl border border-cocoa/10 bg-vanilla/70 p-5"
                >
                  <h3 className="font-semibold text-cocoa">{item.question}</h3>
                  <p className="mt-2 text-sm text-ink-muted">{item.answer}</p>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>

      <section className="bg-blush/50 py-12 sm:py-16">
        <div className="mx-auto w-full max-w-5xl px-4 text-center">
          <FadeUp>
            <h2 className="font-display text-2xl font-bold text-cocoa sm:text-3xl">
              Ready to order?
            </h2>
            <p className="mt-2 text-ink-muted">
              Message us on WhatsApp and we&apos;ll help you pick the perfect bake.
            </p>
            <a
              href={waHref(getShopWhatsapp(), "Hi Tamera! I'd like to place an order.")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[#25d366] px-8 py-3 font-semibold text-cocoa transition hover:opacity-90"
            >
              Message us on WhatsApp
            </a>
          </FadeUp>
        </div>
      </section>
    </>
  );
}
