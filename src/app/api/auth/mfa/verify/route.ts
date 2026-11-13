import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const supabase = await createClient(await cookies());
  const { factorId, code } = await request.json();

  if (!factorId || !code) {
    return NextResponse.json({ error: "factorId and code are required" }, { status: 400 });
  }

  const { data, error } = await supabase.auth.mfa.verify({
    factorId,
    code: code.trim(),
  } as any);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ aal: (data as any).aal });
}