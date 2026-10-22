/**
 * Storage paths for cake reference photos.
 *
 * The path is derived from the *validated mime type*, never from the file name
 * the browser sent: a customer-supplied name could carry a traversal (`../`),
 * a double extension (`photo.jpg.exe`) or a mismatched type. The name is kept
 * only for display.
 */

export const PHOTO_BUCKET = "cake-references";

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * `cakes/<id>.<ext>` — a flat, opaque path.
 *
 * The id is random, so two customers never collide and the path leaks nothing
 * about the customer. The folder is created per upload rather than per order
 * because the order does not exist yet when the photo is uploaded.
 */
export function buildPhotoPath(contentType: string, id: string): string {
  const ext = EXTENSION_BY_TYPE[contentType];
  if (!ext) {
    throw new Error(`Unsupported photo type: ${contentType}`);
  }
  return `cakes/${id}.${ext}`;
}

/**
 * The public URL of a stored photo, read from the public project url.
 *
 * Returns null when the project url is not configured — a missing preview is
 * better than a broken page, and the env var is missing in some test and
 * build environments.
 */
export function publicPhotoUrlFromEnv(path: string): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return publicPhotoUrl(path, url);
}

/**
 * The public URL of a stored photo.
 *
 * `cake-references` is a public bucket (see `supabase/migrations/0006_storage.sql`),
 * so a stored path is readable by anyone holding the URL — the same visibility
 * the shop's own staff need to see the customer's reference photo.
 */
export function publicPhotoUrl(path: string, supabaseUrl: string): string {
  const encoded = path
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
    .map(encodeURIComponent)
    .join("/");
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${encoded}`;
}
