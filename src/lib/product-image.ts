/**
 * Where a product photo actually lives.
 *
 * The seed stores a public path (`/showcase/01-…jpg`) for the showcase cakes
 * and a Supabase storage path (`products/abc.jpg`) for anything uploaded from
 * the dashboard. One helper so every screen renders both.
 */

const BUCKET = "product-images";

export function resolveProductImage(
  imageUrl: string | null | undefined,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("/") || /^https?:\/\//i.test(imageUrl)) return imageUrl;
  if (!supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${imageUrl}`;
}
