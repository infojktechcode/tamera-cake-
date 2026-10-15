"use cache";

import { cacheLife, cacheTag } from "next/cache";
import { getPublicClient } from "./supabase/public";

export type PublicSettings = {
  shop_name: string;
  whatsapp_number: string;
  address: string | null;
  opening_hours: Record<string, { open: string; close: string }>; // keys mon..sun
};
export type ShowcaseCake = {
  slug: string;
  name: string;
  description: string | null;
  image_url: string;
  price: number;
};
export type FlavourCard = {
  id: string;
  name: string;
  price_per_kg: number;
  image_url: string | null;
};
export type PastryItem = {
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  category: string;
};
export type ShareProduct = {
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  category_name: string;
  category_kind: "cake" | "pastry";
};

export async function getPublicSettings(): Promise<PublicSettings> {
  cacheTag("catalog");
  cacheLife("hours");
  const { data, error } = await getPublicClient()
    .from("settings")
    .select("shop_name,whatsapp_number,address,opening_hours")
    .single();
  if (error) throw new Error(`getPublicSettings: ${error.message}`);
  return data as PublicSettings;
}

/** The 8 showcase cakes are the only products with `/showcase/*.jpg` images. */
export async function getFeaturedCakes(limit = 4): Promise<ShowcaseCake[]> {
  cacheTag("catalog");
  cacheLife("hours");
  const { data, error } = await getPublicClient()
    .from("products")
    .select("slug,name,description,image_url,price,category:categories!inner(kind,active)")
    .eq("categories.kind", "cake")
    .eq("categories.active", true)
    .eq("available", true)
    .like("image_url", "/showcase/*.jpg")
    .order("sort_order", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`getFeaturedCakes: ${error.message}`);
  return (data ?? []).map((row) => ({
    slug: row.slug,
    name: row.name,
    description: row.description,
    image_url: row.image_url,
    price: row.price,
  }));
}

export async function getFlavourCards(): Promise<FlavourCard[]> {
  cacheTag("catalog");
  cacheLife("hours");
  const { data, error } = await getPublicClient()
    .from("cake_flavours")
    .select("id,name,price_per_kg,image_url")
    .eq("available", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`getFlavourCards: ${error.message}`);
  return (data ?? []) as FlavourCard[];
}

/** Active pastry category names, sorted. Chips prepend "All" in the component. */
export async function getPastryCategories(): Promise<string[]> {
  cacheTag("catalog");
  cacheLife("hours");
  const { data, error } = await getPublicClient()
    .from("categories")
    .select("name")
    .eq("kind", "pastry")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`getPastryCategories: ${error.message}`);
  return (data ?? []).map((row) => row.name);
}

export async function getPastries(): Promise<PastryItem[]> {
  cacheTag("catalog");
  cacheLife("hours");
  const { data, error } = await getPublicClient()
    .from("products")
    .select("slug,name,description,image_url,price,category:categories!inner(name)")
    .eq("available", true)
    .eq("categories.kind", "pastry")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`getPastries: ${error.message}`);
  return (data ?? []).map((row) => {
    // Runtime shape is a single object (m:1); the select-string parser can't
    // infer cardinality, so it types the embed as an array — cast it back.
    const category = row.category as unknown as { name: string } | null;
    return {
      slug: row.slug,
      name: row.name,
      description: row.description,
      image_url: row.image_url,
      price: row.price,
      category: category?.name ?? "",
    };
  });
}

/** Available product slugs for generateStaticParams. */
export async function getProductSlugs(): Promise<string[]> {
  cacheTag("catalog");
  cacheLife("hours");
  const { data, error } = await getPublicClient()
    .from("products")
    .select("slug")
    .eq("available", true);
  if (error) throw new Error(`getProductSlugs: ${error.message}`);
  return (data ?? []).map((row) => row.slug);
}

/** null when not found — unknown slug is a 404, not an error. */
export async function getProductBySlug(slug: string): Promise<ShareProduct | null> {
  cacheTag("catalog");
  cacheLife("hours");
  const { data, error } = await getPublicClient()
    .from("products")
    .select("slug,name,description,image_url,price,category:categories(name,kind)")
    .eq("slug", slug)
    .eq("available", true)
    .maybeSingle();
  if (error) throw new Error(`getProductBySlug: ${error.message}`);
  if (!data) return null;
  // m:1 embed — single object at runtime (see getPastries note).
  const category = data.category as unknown as { name: string; kind: string } | null;
  return {
    slug: data.slug,
    name: data.name,
    description: data.description,
    image_url: data.image_url,
    price: data.price,
    category_name: category?.name ?? "",
    category_kind: category?.kind === "cake" ? "cake" : "pastry",
  };
}
