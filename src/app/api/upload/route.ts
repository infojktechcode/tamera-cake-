import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getSupabaseService } from "../../lib/supabase/service";
import { PhotoUploadInput, type PhotoUploadInputType } from "../../lib/validators/upload.schema";

/** Simple in-memory per-IP rate limiter: 1 upload every 5s per IP. */
const buckets = new Map<string, number>();
const WINDOW_MS = 5_000;

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forward-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return "unknown";
}

export async function POST(req: NextRequest): Promise<Response> {
  const ip = clientIp(req);
  const now = Date.now();
  const last = buckets.get(ip) ?? 0;
  if (now - last < WINDOW_MS) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  buckets.set(ip, now);

  let fields: Record<string, unknown>;
  try {
    fields = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  const parsed = PhotoUploadInput.safeParse({
    name: String(fields.get("name") ?? ""),
    mime: String(fields.get("mime") ?? ""),
    size: Number(fields.get("size") ?? 0),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input: PhotoUploadInputType = parsed.data;

  // Request a signed upload URL from Supabase Storage. RLS allows public reads;
  // writes are checked at insert time by the storage policy.
  try {
    const supabase = getSupabaseService();
    const stored = await supabase.storage.from("cake-references").createSignedUploadUrl(input.name);
    const path = stored.path as string;
    return NextResponse.json({ ok: true, path, url: stored.signedUrl as string });
  } catch {
    return NextResponse.json({ ok: false, error: "supabase" }, { status: 500 });
  }
}
