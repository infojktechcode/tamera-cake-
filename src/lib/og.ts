import type { Metadata } from "next";

export type ShareMetaProduct = {
  slug?: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
};

export const SHARE_FALLBACK_DESCRIPTION =
  "Order fresh from Tamera's Cakes & Bakery on WhatsApp.";

/**
 * Build Next.js Metadata for a product share page. `siteUrl` is passed in
 * (rather than read from env here) purely so the helper stays a pure
 * function under test — the page supplies it via `getSiteUrl()`.
 */
export function buildShareMetadata(product: ShareMetaProduct, siteUrl: string): Metadata {
  const description = product.description?.trim() || SHARE_FALLBACK_DESCRIPTION;
  // og:image must be absolute for WhatsApp previews — resolve against siteUrl.
  // Metadata accepts string | { url } — we use the object form (test asserts .url).
  const images = product.image_url
    ? [{ url: new URL(product.image_url, siteUrl).toString() }]
    : [];
  return {
    title: product.name,
    description,
    openGraph: { type: "website", title: product.name, description, images },
    ...(product.slug
      ? { alternates: { canonical: new URL(`/p/${encodeURIComponent(product.slug)}`, siteUrl) } }
      : {}),
  };
}

/**
 * Build Next.js Metadata for a standalone public page (home, cakes, gallery…).
 *
 * Includes Open Graph, Twitter/X, and a canonical URL so WhatsApp/Twitter
 * previews render correctly. `image` (if given) is resolved to an absolute
 * URL against `siteUrl`. Pure function — the page supplies `siteUrl` via
 * `getSiteUrl()`.
 */
export function buildPageMetadata(opts: {
  title: string;
  description: string;
  siteUrl: string;
  path?: string;
  image?: string | null;
}): Metadata {
  const { title, description, siteUrl, path, image } = opts;
  const images = image ? [{ url: new URL(image, siteUrl).toString() }] : [];
  return {
    title,
    description,
    openGraph: { type: "website", title, description, images },
    twitter: { card: "summary", title, description, ...(images.length ? { images } : {}) },
    ...(path ? { alternates: { canonical: new URL(path, siteUrl) } } : {}),
  };
}
