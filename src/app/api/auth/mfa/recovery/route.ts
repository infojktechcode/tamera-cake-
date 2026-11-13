import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const supabase = await createClient(await cookies());
  const { factorId, recoveryCode } = await request.json();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // If recoveryCode provided, verify it and remove MFA factor
  if (recoveryCode) {
    // Verify recovery code using service role (bypasses RLS)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json({ error: "Service role not configured" }, { status: 500 });
    }

    // 1. Fetch stored hashes from service-only table
    const fetchResponse = await fetch(
      `${supabaseUrl}/rest/v1/mfa_recovery_codes?user_id=eq.${user.id}`,
      {
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    if (!fetchResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch recovery codes" }, { status: 500 });
    }

    const rows = await fetchResponse.json();
    if (!rows.length) {
      return NextResponse.json({ error: "No recovery codes available" }, { status: 400 });
    }

    const storedHashes: string[] = rows[0].code_hashes;
    const bcrypt = await import("bcryptjs");
    let matchedIndex = -1;
    for (let i = 0; i < storedHashes.length; i++) {
      if (await bcrypt.compare(recoveryCode.trim().toUpperCase(), storedHashes[i])) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex === -1) {
      return NextResponse.json({ error: "Invalid recovery code" }, { status: 400 });
    }

    // 2. Remove the used code from array
    const updatedHashes = storedHashes.filter((_, i) => i !== matchedIndex);

    // 3. Update the service table (or delete if no codes left)
    if (updatedHashes.length > 0) {
      await fetch(
        `${supabaseUrl}/rest/v1/mfa_recovery_codes?user_id=eq.${user.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ code_hashes: updatedHashes, updated_at: new Date().toISOString() }),
        }
      );
    } else {
      await fetch(
        `${supabaseUrl}/rest/v1/mfa_recovery_codes?user_id=eq.${user.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        }
      );
    }

    // 4. Remove the MFA factor via Admin API
    const factorResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${user.id}/factors/${factorId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!factorResponse.ok) {
      const error = await factorResponse.json();
      console.error("[MFA Recovery] Failed to remove factor:", error);
      return NextResponse.json({ error: "Failed to remove MFA factor" }, { status: 500 });
    }

    // 5. Audit log
    console.log(`[AUDIT] User ${user.email} used recovery code, MFA factor ${factorId} removed. Must re-enroll.`);

    // 6. Return success - user MUST re-enroll TOTP to get AAL2 back
    return NextResponse.json({
      success: true,
      mfaRemoved: true,
      message: "MFA has been removed. You must re-enroll TOTP to regain superadmin access.",
      redirectTo: "/admin/security/mfa/enroll",
    });
  }

  // Generate new recovery codes (10 codes) - called during initial enrollment
  // This endpoint requires service role, so it's called from the enrollment flow
  const authHeader = request.headers.get("authorization");
  const isServiceRole = authHeader === `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;

  if (!isServiceRole) {
    return NextResponse.json({ error: "Service role required to generate recovery codes" }, { status: 403 });
  }

  const { userId } = await request.json();
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const recoveryCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );

  const bcrypt = await import("bcryptjs");
  const hashedCodes = await Promise.all(
    recoveryCodes.map((code) => bcrypt.hash(code, 12))
  );

  // Store in service-only table
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

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