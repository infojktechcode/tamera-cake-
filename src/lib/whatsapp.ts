import { normalizePhone } from "./phone";

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
