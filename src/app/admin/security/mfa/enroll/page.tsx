import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { MfaEnrollView } from "./MfaEnrollView";

export default async function MfaEnrollPage() {
  const supabase = await createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check if already enrolled
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors?.totp && factors.totp.length > 0) {
    redirect("/admin/security/mfa/challenge");
  }

  // Enroll new TOTP factor
  const { data: factor, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Tamera WhatsApp Orders",
    friendlyName: user.email ?? "Superadmin",
  });

  if (error) {
    console.error("MFA enroll error:", error);
    throw error;
  }

  return (
    <MfaEnrollView
      qrCode={factor.totp?.qr_code}
      secret={factor.totp?.secret}
      factorId={factor.id}
      userId={user.id}
    />
  );
}