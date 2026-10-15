import type { Metadata } from "next";

export type ShareMetaProduct = {
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
  };
}
