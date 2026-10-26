import { NextResponse } from "next/server";

import { can } from "@/lib/permissions";
import { PRODUCT_IMAGE_BUCKET, buildProductImagePath } from "@/lib/product-image";
import { getStaffSession } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/service";
import { uploadRequestSchema } from "@/lib/validators/upload.schema";

/**
 * POST /api/admin/product-image — sign an upload for a product photo.
 *
 * Staff only, unlike the customer reference-photo route. The browser then PUTs
 * the bytes straight to the `product-images` bucket, so the image never passes
 * through this server. The returned path is what `PATCH /api/admin/products/[id]`
 * stores in `image_url`.
 */

export async function POST(req: Request) {
  const session = await getStaffSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }
  if (!can(session.user.role, "manageProducts")) {
    return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const parse = uploadRequestSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { ok: false, error: parse.error.issues[0]?.message ?? "Please choose a JPG, PNG or WebP photo." },
      { status: 400 },
    );
  }

  const path = buildProductImagePath(parse.data.type, crypto.randomUUID());

  try {
    const { data, error } = await createServiceClient()
      .storage.from(PRODUCT_IMAGE_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !data) {
      throw new Error(error?.message ?? "no signed url returned");
    }

    return NextResponse.json({ ok: true, path: data.path, token: data.token });
  } catch (e) {
    console.error(`POST /api/admin/product-image: ${(e as Error).message}`);
    return NextResponse.json(
      { ok: false, error: "We could not prepare that photo. Please try again." },
      { status: 500 },
    );
  }
}
