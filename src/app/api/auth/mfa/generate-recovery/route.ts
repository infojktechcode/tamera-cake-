import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  // This endpoint generates recovery codes after successful TOTP enrollment
  // Called by client after mfa.verify() succeeds
  const supabase = await createClient(await cookies());
  const { factorId, userId } = await request.json();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Verify the user actually has this factor enrolled
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasFactor = factors?.totp?.some((f) => f.id === factorId);
  if (!hasFactor) {
    return NextResponse.json({ error: "Factor not found" }, { status: 400 });
  }

  // Generate 10 recovery codes
  const recoveryCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );

  const bcrypt = await import("bcryptjs");
  const hashedCodes = await Promise.all(
    recoveryCodes.map((code) => bcrypt.hash(code, 12))
  );

  // Store in service-only table using service role
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 500 });
  }

  const insertResponse = await fetch(`${supabaseUrl}/rest/v1/mfa_recovery_codes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      user_id: userId,
      code_hashes: hashedCodes,
    }),
  });

  if (!insertResponse.ok) {
    const error = await insertResponse.json();
    return NextResponse.json({ error: error.message || "Failed to store recovery codes" }, { status: 500 });
  }

  return NextResponse.json({ recoveryCodes });
}