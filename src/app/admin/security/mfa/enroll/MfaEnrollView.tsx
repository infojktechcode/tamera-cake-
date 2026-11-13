"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

interface MfaEnrollViewProps {
  qrCode: string | undefined;
  secret: string | undefined;
  factorId: string;
  userId: string;
}

export function MfaEnrollView({ qrCode, secret, factorId, userId }: MfaEnrollViewProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setVerifying(true);

    try {
      const supabase = createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey());

      const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        code: code.trim(),
      } as any);

      if (error) {
        setError(error.message);
        setVerifying(false);
        return;
      }

      // Success — AAL2 session established
      // Now generate recovery codes via server endpoint
      const response = await fetch("/api/auth/mfa/generate-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorId, userId }),
      });

      if (response.ok) {
        const data = await response.json();
        setRecoveryCodes(data.recoveryCodes);
      }

      // Redirect to admin dashboard after a moment
      setTimeout(() => window.location.href = "/admin", 2000);
    } catch (err) {
      setError("Verification failed. Please try again.");
      setVerifying(false);
    }
  };

  if (recoveryCodes) {
    return (
      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">MFA Enabled!</h1>
          <p className="text-gray-600 mt-2">Your authenticator app is now linked. Save your recovery codes below.</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-800 mb-3">⚠️ Recovery Codes (save these now!)</h3>
          <p className="text-sm text-amber-700 mb-3">
            Each code can be used once. Store them securely — you won't see them again.
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm font-mono bg-white p-3 rounded border">
            {recoveryCodes.map((c, i) => (
              <div key={i} className="break-all">{c}</div>
            ))}
          </div>
        </div>

        <a href="/admin" className="block text-center text-blue-600 hover:underline mt-4">
          Continue to Dashboard →
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Enable Two-Factor Authentication</h1>
        <p className="text-gray-600 mt-2">Scan the QR code with your authenticator app</p>
      </div>

      {qrCode && (
        <div className="bg-white p-4 rounded-lg border text-center">
          <img
            src={qrCode}
            alt="MFA QR Code"
            className="mx-auto"
            style={{ maxWidth: "200px" }}
          />
        </div>
      )}

      {secret && (
        <details className="text-sm text-gray-600">
          <summary className="cursor-pointer mb-2">Can't scan? Show manual entry code</summary>
          <code className="break-all bg-gray-100 px-2 py-1 rounded">{secret}</code>
        </details>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="code" className="block text-sm font-medium mb-1">
            Enter 6-digit code from authenticator app
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
          {verifying ? "Verifying..." : "Verify & Continue"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">
        <a href="/admin" className="text-blue-600 hover:underline">Back to login</a>
      </p>
    </div>
  );
}