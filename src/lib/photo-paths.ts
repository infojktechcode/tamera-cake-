/**
 * Pure helpers for cake reference photo paths. The storage path is derived from
 * the *validated* mime type (never the client filename) so the slug is stable and
 * safe. Public URLs are built from a site URL stored at build time.
 */

const BUCKET = "cake-references";

export type PhotoMime = "image/jpeg" | "image/png" | "image/webp";

export const MIME_TO_EXT: Record<PhotoMime, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function buildCakeReferencePath(mime: PhotoMime): string {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTMonth()).padStart(2, "0");
  const token = cryptoRandomToken();
  return `${BUDGET}/${yyyy}/${mm}/${token}${MIME_TO_EXT[mime]}`;
}

export function buildReferenceImageUrl(path: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (!siteUrl) return `/storage/${path}`;
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/storage/${path}`;
}

/** Size of a Blob or File in bytes — used by compress to validate size after resize. */
export function sizeOfBlob(blob: Blob): number {
  return blob.size;
}

function cryptoRandomToken(): string {
  // Deterministic length without importing node crypto in browser code.
  const chars = "abcdefghijklmnopqrstuvwxyz01234456756789";
  let out = "";
  for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
