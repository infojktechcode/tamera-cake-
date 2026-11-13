import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient(await cookies());

  // Verify caller is superadmin with AAL2
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden: superadmin only" }, { status: 403 });
  }

  const aal = user.app_metadata?.aal || user.user_metadata?.aal;
  if (aal !== "aal2") {
    return NextResponse.json({ error: "MFA required for this action" }, { status: 403 });
  }

  const { id: targetUserId } = await params;

  // Prevent self-reset (must use own recovery codes)
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Cannot reset own MFA via this endpoint" }, { status: 400 });
  }

  // Verify target user exists and is superadmin
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", targetUserId)
    .single();

  if (!targetProfile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (targetProfile.role !== "superadmin") {
    return NextResponse.json({ error: "Can only reset MFA for superadmin users" }, { status: 400 });
  }

  // Get target user's email from auth.users via admin API
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 500 });
  }

  // Call Supabase Admin API to get target user details
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetUserId}`, {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!userResponse.ok) {
    return NextResponse.json({ error: "Failed to fetch target user" }, { status: 500 });
  }

  const targetUserData = await userResponse.json();
  const targetEmail = targetUserData.email || "unknown";

  // Call Supabase Admin API to unenroll all factors
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetUserId}/factors`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    return NextResponse.json({ error: error.message || "Failed to reset MFA" }, { status: 500 });
  }

  // Also clear recovery codes from user_metadata
  await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetUserId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_metadata: { recovery_codes: [] },
    }),
  });

  // Audit log
  console.log(`[AUDIT] Superadmin ${user.email} reset MFA for ${targetEmail} (${targetUserId})`);

  return NextResponse.json({ success: true });
}