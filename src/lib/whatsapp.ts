import { normalizePhone } from "./phone";

/** https://wa.me/<digits>?text=<encoded message> — spec §9 link shape. */
export function waHref(number: string, message: string): string {
  const digits = normalizePhone(number);
  if (!digits) throw new Error(`waHref: unusable WhatsApp number "${number}"`);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * The same link, or null when the number cannot be dialled.
 *
 * The dashboard shows a WhatsApp button on every order, and a customer row
 * may hold a number that is not a Kenyan mobile number (a landline, a typo in
 * an old walk-in order). `waHref` throws for those; here the button is simply
 * not rendered.
 */
export function waHrefSafe(number: string, message: string): string | null {
  const digits = normalizePhone(number);
  if (!digits) return null;
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
