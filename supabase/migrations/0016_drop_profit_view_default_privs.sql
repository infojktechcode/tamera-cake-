-- 0016_drop_profit_view_default_privs.sql
-- Drop sales_daily_profit (profit moves to server route with viewProfit capability)
-- Set default privileges for role postgres to prevent future anon/public grants

begin;

-- 1. Drop the profit view — profit computation moves to API route
drop view if exists sales_daily_profit;

-- 2. Revoke any remaining privileges on dropped view (cleanup)
-- Only if the view still exists (may already be dropped on remote)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sales_daily_profit' AND relkind = 'v') THEN
    EXECUTE 'revoke all on sales_daily_profit from anon, public, authenticated';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- Object doesn't exist, skip
    NULL;
END $$;

-- 3. Default privileges for role postgres (owner of schema objects)
-- Prevents future GRANT ... TO PUBLIC leaks on new tables/views/functions
alter default privileges for role postgres in schema public
  revoke all on tables from anon, public;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, public;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, public;
alter default privileges for role postgres in schema public
  revoke all on types from anon, public;

-- 4. Also apply to existing objects (belt-and-suspenders for postgres-owned)
revoke all on all tables in schema public from anon, public;
revoke all on all functions in schema public from anon, public;
revoke all on all sequences in schema public from anon, public;

-- 5. Grant defaults to authenticated role for future objects
alter default privileges for role postgres in schema public
  grant select on tables to authenticated;
alter default privileges for role postgres in schema public
  grant execute on functions to authenticated;
alter default privileges for role postgres in schema public
  grant usage on sequences to authenticated;

commit;