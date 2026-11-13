-- migration: 0019_rls_aal2_superadmin.sql
-- description: RESTRICTIVE policies requiring AAL2 for superadmin sensitive operations
-- author: P1-9 MFA implementation - revised

BEGIN;

-- ============================================================================
-- RESTRICTIVE POLICIES: These ADD restrictions on top of existing permissive policies
-- They use (select auth.jwt()->>'aal') = 'aal2' for superadmin checks
-- ============================================================================

-- Helper function to check AAL level from JWT
CREATE OR REPLACE FUNCTION current_aal() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(auth.jwt()->>'aal', 'aal1');
$$;

-- Helper: is current user a superadmin (regardless of AAL)
CREATE OR REPLACE FUNCTION is_superadmin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND active = true
    AND role = 'superadmin'
  );
$$;

-- Helper: is current user a superadmin WITH AAL2
CREATE OR REPLACE FUNCTION is_superadmin_aal2() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT is_superadmin() AND current_aal() = 'aal2';
$$;

-- ============================================================================
-- ORDERS: Superadmin write requires AAL2 (RESTRICTIVE)
-- Managers keep their existing permissive policies
-- Superadmin at AAL1 can READ but not WRITE
-- ============================================================================
DROP POLICY IF EXISTS "superadmin_write_requires_aal2_insert" ON orders;
CREATE POLICY "superadmin_write_requires_aal2_insert" ON orders
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (NOT is_superadmin() OR is_superadmin_aal2());

DROP POLICY IF EXISTS "superadmin_write_requires_aal2_update" ON orders;
CREATE POLICY "superadmin_write_requires_aal2_update" ON orders
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (NOT is_superadmin() OR is_superadmin_aal2())
  WITH CHECK (NOT is_superadmin() OR is_superadmin_aal2());

DROP POLICY IF EXISTS "superadmin_write_requires_aal2_delete" ON orders;
CREATE POLICY "superadmin_write_requires_aal2_delete" ON orders
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (NOT is_superadmin() OR is_superadmin_aal2());

-- ============================================================================
-- ORDER_ITEMS: No additional restrictive policies needed
-- (cost/profit data doesn't exist in this table - moved to API routes)
-- ============================================================================

-- ============================================================================
-- EXPENSES: Superadmin only, AAL2 required for ALL operations
-- ============================================================================
DROP POLICY IF EXISTS "superadmin_expenses_aal2" ON expenses;
CREATE POLICY "superadmin_expenses_aal2" ON expenses
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (is_superadmin_aal2())
  WITH CHECK (is_superadmin_aal2());

-- ============================================================================
-- PAYMENTS: Superadmin write requires AAL2
-- ============================================================================
DROP POLICY IF EXISTS "superadmin_payments_write_aal2_insert" ON payments;
CREATE POLICY "superadmin_payments_write_aal2_insert" ON payments
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (NOT is_superadmin() OR is_superadmin_aal2());

DROP POLICY IF EXISTS "superadmin_payments_write_aal2_update" ON payments;
CREATE POLICY "superadmin_payments_write_aal2_update" ON payments
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (NOT is_superadmin() OR is_superadmin_aal2())
  WITH CHECK (NOT is_superadmin() OR is_superadmin_aal2());

DROP POLICY IF EXISTS "superadmin_payments_write_aal2_delete" ON payments;
CREATE POLICY "superadmin_payments_write_aal2_delete" ON payments
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (NOT is_superadmin() OR is_superadmin_aal2());

-- ============================================================================
-- PROFILES: User management (superadmin only, AAL2)
-- BUT: superadmin at AAL1 MUST be able to read THEIR OWN profile
-- and reach enroll/challenge pages
-- ============================================================================
DROP POLICY IF EXISTS "superadmin_profiles_manage_aal2_insert" ON profiles;
CREATE POLICY "superadmin_profiles_manage_aal2_insert" ON profiles
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (is_superadmin_aal2());

DROP POLICY IF EXISTS "superadmin_profiles_manage_aal2_update" ON profiles;
CREATE POLICY "superadmin_profiles_manage_aal2_update" ON profiles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (is_superadmin_aal2())
  WITH CHECK (is_superadmin_aal2());

DROP POLICY IF EXISTS "superadmin_profiles_manage_aal2_delete" ON profiles;
CREATE POLICY "superadmin_profiles_manage_aal2_delete" ON profiles
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (is_superadmin_aal2());

-- Superadmin at AAL1 can SELECT their own profile (for session loading)
-- This is a PERMISSIVE policy (default) that allows self-read
DROP POLICY IF EXISTS "self_profile_read" ON profiles;
CREATE POLICY "self_profile_read" ON profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Superadmin at AAL2 can SELECT all profiles (for user management UI)
DROP POLICY IF EXISTS "superadmin_profiles_read_all_aal2" ON profiles;
CREATE POLICY "superadmin_profiles_read_all_aal2" ON profiles
  FOR SELECT
  TO authenticated
  USING (is_superadmin_aal2());

-- ============================================================================
-- SETTINGS: Superadmin only, AAL2 required for UPDATE
-- ============================================================================
DROP POLICY IF EXISTS "superadmin_settings_aal2" ON settings;
CREATE POLICY "superadmin_settings_aal2" ON settings
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (is_superadmin_aal2())
  WITH CHECK (is_superadmin_aal2());

-- ============================================================================
-- MFA_RECOVERY_CODES: Service-role only (no client access)
-- Already protected by RLS with no policies
-- ============================================================================

COMMIT;