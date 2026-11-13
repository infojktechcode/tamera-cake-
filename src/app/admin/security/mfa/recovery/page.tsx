"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

export default function MfaRecoveryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/admin/security/mfa/enroll";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setVerifying(true);

    try {
      const supabase = createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey());

      // Get the TOTP factor ID
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];

      if (!totpFactor) {
        setError("No MFA factor found. Please re-enroll.");
        setVerifying(false);
        return;
      }

      // Use recovery code endpoint - this removes MFA and forces re-enrollment
      const response = await fetch("/api/auth/mfa/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorId: totpFactor.id, recoveryCode: code.trim().toUpperCase() }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Invalid recovery code");
        setVerifying(false);
        return;
      }

      const data = await response.json();

      // Success — MFA removed, redirect to enroll page
      router.push(data.redirectTo || redirectTo);
      router.refresh();
    } catch (err) {
      setError("Verification failed. Please try again.");
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Use Recovery Code</h1>
        <p className="text-gray-600 mt-2">
          Enter one of your 8-character recovery codes. This will remove your current MFA
          and require you to set up a new authenticator app.
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="code" className="block text-sm font-medium mb-1">
            Recovery Code (8 characters)
          </label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
            placeholder="ABC12345"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-center text-2xl tracking-widest font-mono"
            maxLength={8}
            autoComplete="one-time-code"
            required
            disabled={verifying}
          />
        </div>

        <button
          type="submit"
          disabled={verifying || code.length < 6}
          className="w-full bg-amber-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {verifying ? "Verifying..." : "Use Recovery Code"}
        </button>

        <p className="text-center text-sm text-gray-500">
          <a href="/admin/security/mfa/challenge" className="text-blue-600 hover:underline">
            Use authenticator app instead
          </a>
        </p>
      </form>

      <p className="text-center text-sm text-gray-500">
        <a href="/login" className="text-blue-600 hover:underline">Sign in as different user</a>
      </p>
    </div>
  );
}