import { normalizePhone } from "./phone";
import { getSupabaseService } from "./supabase/service";
import { buildCakeReferencePath } from "./photo-paths";

/** https://wa.me/<digits>?text=<encoded message> — spec §9 link shape. */
export function waHref(number: string, message: string): string {
  const digits = normalizePhone(number);
  if (!digits) throw new Error(`waHref: unusable WhatsApp number "${number}"`);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Shop WhatsApp from env; throws loudly when missing/invalid (fail fast). */
export function getShopWhatsapp(): string {
  const raw = process.env.NEXT_PUBLIC_SHOP_WHATSAPP;
  if (!raw) throw new Error("Missing NEXT_PUBLIC_SHOP_WHATSAPP. Copy .env.example to .env.local.");
  const digits = normalizePhone(raw);
  if (!digits) throw new Error(`Invalid NEXT_PUBLIC_SHOP_WHATSAPP: "${raw}"`);
  return digits;
}

/**
 * Request a signed upload URL for a cake reference photo via Supabase Storage.
 * Returns the storage path the client should PUT the file to (then replaces
 * placeholder path with a real one when available).
 */
export async function requestPhotoUpload(mime: "image/jpeg" | "image/png" | "image/webp"): Promise<string> {
  const supabase = getSupabaseService();
  const bucket = "cake-references";
  // Supabase's storage API returns a signed URL + path for an authenticated upload.
  const stored = await supabase.storage.from(bucket).createSignedUploadUrl(buildCakeReferencePath(mime));
  return stored.path as string;
}
