"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

export default function MfaChallengePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/admin";

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

      // Verify TOTP code
      const { data, error } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        code: code.trim(),
      } as any);

      if (error) {
        setError(error.message);
        setVerifying(false);
        return;
      }

      // Success — AAL2 session established, redirect to original destination
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError("Verification failed. Please try again.");
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Two-Factor Authentication Required</h1>
        <p className="text-gray-600 mt-2">Enter the 6-digit code from your authenticator app</p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="code" className="block text-sm font-medium mb-1">
            6-digit Code
          </label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-center text-2xl tracking-widest font-mono"
            maxLength={6}
            autoComplete="one-time-code"
            required
            disabled={verifying}
          />
        </div>

        <button
          type="submit"
          disabled={verifying || code.length !== 6}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {verifying ? "Verifying..." : "Verify"}
        </button>

        <p className="text-center text-sm text-gray-500">
          <a href="/admin/security/mfa/recovery" className="text-blue-600 hover:underline">
            Use recovery code instead
          </a>
        </p>
      </form>

      <p className="text-center text-sm text-gray-500">
        <a href="/login" className="text-blue-600 hover:underline">Sign in as different user</a>
      </p>
    </div>
  );
}