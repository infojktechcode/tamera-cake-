"use client";

import { compressImage } from "./photo-compress";
import { PHOTO_BUCKET } from "./photo-paths";
import { getPublicClient } from "./supabase/public";

/**
 * Upload one reference photo.
 *
 * Two steps:
 *   1. `POST /api/upload` asks the server to sign a path for this file. The
 *      server validates the type and size and is the only place that talks to
 *      the service-role key.
 *   2. The browser PUTs the bytes straight to Supabase storage with the signed
 *      token, so a 5 MB photo never passes through the app server.
 *
 * Returns the storage path, which is what the order stores.
 */

export interface UploadedPhoto {
  path: string;
  name: string;
}

export async function uploadReferencePhoto(file: File): Promise<UploadedPhoto> {
  const photo = await compressImage(file);

  const res = await fetch("/api/upload", {
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
    throw new Error(json.error ?? "We could not save that photo. Please try again.");
  }

  const { error } = await getPublicClient()
    .storage.from(PHOTO_BUCKET)
    .uploadToSignedUrl(json.path, json.token, photo, {
      contentType: photo.type,
      upsert: true,
    });

  if (error) {
    throw new Error("We could not upload that photo. Please try another one.");
  }

  return { path: json.path, name: photo.name };
}
