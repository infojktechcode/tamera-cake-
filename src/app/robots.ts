import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/supabase/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/order/cake"],
      disallow: ["/admin/", "/api/", "/cart", "/checkout", "/order/"],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
