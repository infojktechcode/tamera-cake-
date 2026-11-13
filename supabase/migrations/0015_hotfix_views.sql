-- 0015_hotfix_views.sql
-- Hotfix: set security_invoker = true on existing views, revoke from anon/public
-- Run in a single transaction

begin;

-- 1. Set security_invoker = true on existing views (preserves definitions & column names)
alter view orders_balance set (security_invoker = true);
alter view sales_daily set (security_invoker = true);
alter view sales_daily_profit set (security_invoker = true);

-- 2. Revoke ALL from anon AND public (belt-and-suspenders)
revoke all on orders_balance from anon, public;
revoke all on sales_daily from anon, public;
revoke all on sales_daily_profit from anon, public;

-- 3. Grant SELECT to authenticated — RLS on underlying tables does the role separation
grant select on orders_balance to authenticated;
grant select on sales_daily to authenticated;
grant select on sales_daily_profit to authenticated;

commit;