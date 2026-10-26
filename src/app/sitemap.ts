import type { MetadataRoute } from "next";

import { getProductSlugs } from "@/lib/catalog";
import { getSiteUrl } from "@/lib/supabase/env";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const publicPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/cakes`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/pastries`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/order/cake`, changeFrequency: "monthly", priority: 0.6 },
  ];
  const productPages: MetadataRoute.Sitemap = (await getProductSlugs()).map((slug) => ({
    url: `${base}/p/${encodeURIComponent(slug)}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  return [...publicPages, ...productPages];
}
