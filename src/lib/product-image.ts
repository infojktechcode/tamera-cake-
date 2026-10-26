/**
 * Where a product photo actually lives.
 *
 * The seed stores a public path (`/showcase/01-…jpg`) for the showcase cakes
 * and a Supabase storage path (`products/abc.jpg`) for anything uploaded from
 * the dashboard. One helper so every screen renders both.
 */

export const PRODUCT_IMAGE_BUCKET = "product-images";

const BUCKET = PRODUCT_IMAGE_BUCKET;

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * `products/<id>.<ext>` — the storage path for an uploaded product photo.
 *
 * Like the cake reference photos, the extension comes from the validated mime
 * type, never from the file name the browser sent.
 */
export function buildProductImagePath(contentType: string, id: string): string {
  const ext = EXTENSION_BY_TYPE[contentType];
  if (!ext) throw new Error(`Unsupported product image type: ${contentType}`);
  return `products/${id}.${ext}`;
}

export function resolveProductImage(
  imageUrl: string | null | undefined,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("/") || /^https?:\/\//i.test(imageUrl)) return imageUrl;
  if (!supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${imageUrl}`;
}
