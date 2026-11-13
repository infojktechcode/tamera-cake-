-- migration: 0018_mfa_recovery_codes.sql
-- description: Service-only table for MFA recovery codes (replaces user_metadata storage)
-- author: P1-9 MFA implementation - revised

BEGIN;

-- Service-only table for recovery codes. Only service_role can write.
-- Users at AAL1 CANNOT modify this table (RLS blocks all client access).
CREATE TABLE mfa_recovery_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- bcrypt hashes of the 10 recovery codes
  code_hashes text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS - no policies = no client access at all
ALTER TABLE mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically. No policies needed for client access.
-- Only server-side code with service_role key can read/write.

-- Index for cleanup queries
CREATE INDEX idx_mfa_recovery_codes_updated ON mfa_recovery_codes (updated_at);

COMMIT;