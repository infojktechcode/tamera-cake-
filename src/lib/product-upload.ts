"use client";

import { compressImage } from "./photo-compress";
import { PRODUCT_IMAGE_BUCKET } from "./product-image";
import { getPublicClient } from "./supabase/public";

/**
 * Upload one product photo and return its storage path.
 *
 *   1. ask the staff-only route to sign a path,
 *   2. PUT the compressed bytes straight to the `product-images` bucket.
 *
 * The caller then saves the path with `PATCH /api/admin/products/[id]`.
 */
export async function uploadProductPhoto(file: File): Promise<string> {
  const photo = await compressImage(file);

  const res = await fetch("/api/admin/product-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: photo.name,
      type: photo.type,
      size: photo.size,
    }),
  });

  let json: { ok?: boolean; path?: string; token?: string; error?: string };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw new Error("We could not reach the shop. Please try again.");
  }

  if (!res.ok || !json.ok || !json.path || !json.token) {
    throw new Error(json.error ?? "We could not prepare that photo.");
  }

  const { error } = await getPublicClient()
    .storage.from(PRODUCT_IMAGE_BUCKET)
    .uploadToSignedUrl(json.path, json.token, photo, {
      contentType: photo.type,
      upsert: true,
    });

  if (error) {
    throw new Error("We could not upload that photo. Please try another one.");
  }

  return json.path;
}
