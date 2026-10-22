import { NextResponse } from "next/server";

import { PHOTO_BUCKET, buildPhotoPath } from "@/lib/photo-paths";
import { uploadLimiter } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { uploadRequestSchema } from "@/lib/validators/upload.schema";

/**
 * POST /api/upload — hands out a signed upload URL for a reference photo.
 *
 * The browser sends the file's name, mime type and size (never the bytes);
 * this route validates them and asks Supabase storage for a short-lived signed
 * URL. The browser then PUTs the photo straight to storage, so the image never
 * passes through the app server.
 *
 * Why signed URLs instead of a plain upload endpoint:
 *   - a 5 MB body would hit the serverless request-size limit,
 *   - the bucket's own `file_size_limit` and `allowed_mime_types` still apply
 *     to the PUT, so the type and size rules are enforced twice.
 *
 * The path is built from the validated mime type and a random id — a
 * customer-supplied file name never reaches the storage path.
 */

function badRequest(message: string) {
  return NextResponse.json({ ok: false as const, error: message }, { status: 400 });
}

function internalError() {
  return NextResponse.json(
    { ok: false as const, error: "We could not save that photo. Please try again." },
    { status: 500 },
  );
}

export async function POST(
  req: Request,
): Promise<
  NextResponse<
    { ok: true; path: string; token: string } | { ok: false; error: string }
  >
> {
  // --- 1. rate limit by IP (spec §10) ---
  const limit = uploadLimiter.check(req.headers);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false as const, error: "Too many uploads. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) } },
    );
  }

  // --- 2. parse + validate ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const parse = uploadRequestSchema.safeParse(body);
  if (!parse.success) {
    return badRequest(parse.error.issues[0]?.message ?? "Please choose a JPG, PNG or WebP photo.");
  }

  // --- 3. sign the upload ---
  const path = buildPhotoPath(parse.data.type, crypto.randomUUID());

  try {
    const service = createServiceClient();
    const { data, error } = await service.storage
      .from(PHOTO_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !data) {
      throw new Error(error?.message ?? "no signed url returned");
    }

    return NextResponse.json({ ok: true, path: data.path, token: data.token });
  } catch (e) {
    console.error(`POST /api/upload: ${(e as Error).message}`);
    return internalError();
  }
}
