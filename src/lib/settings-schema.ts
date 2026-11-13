/**
 * Zod schemas for the publicly readable `settings` columns.
 *
 * The `settings` table is exposed to anonymous visitors via the
 * `anon_read_settings` RLS policy. Every column we expose here must be
 * safe for public consumption — no API credentials, no SMS provider
 * flags. Daraja and Africa's Talking secrets live only in server env
 * vars; `sms_enabled` / `sms_provider` stay server-side (the notification
 * service reads them with the service client).
 *
 * Each sub-schema is lenient: a malformed or missing value degrades to a
 * safe default rather than throwing, so a bad row can never crash a
 * public page.
 */

import { z } from "zod";

/** Social media links. Unknown keys are dropped; invalid URLs are dropped. */
export const socialLinksSchema = z
  .object({
    whatsapp: z.string().url().optional(),
    facebook: z.string().url().optional(),
    instagram: z.string().url().optional(),
    tiktok: z.string().url().optional(),
  })
  .partial()
  .catch({});

/** A single FAQ entry. Entries missing a question or answer are dropped. */
export const faqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

/** Brand colour palette. Each key is optional. */
export const brandColoursSchema = z
  .object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
    background: z.string().optional(),
  })
  .partial()
  .catch({});

/** Opening hours keyed by day (mon..sun). Malformed rows collapse to {}. */
export const openingHoursSchema = z
  .record(
    z.string(),
    z.object({ open: z.string(), close: z.string() }),
  )
  .catch({});

/**
 * The full set of publicly readable settings. Applies safe defaults so a
 * missing or malformed field never propagates to a render.
 */
export const publicSettingsSchema = z.object({
  shop_name: z.string().catch("Tamera's Cakes & Bakery"),
  whatsapp_number: z.string().catch(""),
  address: z.string().nullable().catch(null),
  opening_hours: openingHoursSchema,
  social_links: socialLinksSchema,
  faq_items: z.array(faqItemSchema).catch([]),
  delivery_policy: z.string().nullable().catch(null),
  payment_policy: z.string().nullable().catch(null),
  cancellation_policy: z.string().nullable().catch(null),
  brand_colours: brandColoursSchema,
  logo_url: z.string().nullable().catch(null),
});

export type SocialLinks = z.infer<typeof socialLinksSchema>;
export type FaqItem = z.infer<typeof faqItemSchema>;
export type BrandColours = z.infer<typeof brandColoursSchema>;
export type OpeningHours = z.infer<typeof openingHoursSchema>;
