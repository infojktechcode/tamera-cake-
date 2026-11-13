-- supabase/tests/0015_views_security_test.sql
-- Run after migrations 0015 and 0016
-- Tests: anon, manager, superadmin access + multi-item order

-- ============================================================
-- SETUP: Create test roles and a test order with 2 items
-- ============================================================

-- Create test users (use existing manager/superadmin if available)
-- We'll use SET ROLE to simulate

-- First, create a test order with 2 items (pastry + cake) for multi-item test
-- Use service role to bypass RLS for setup
set role service_role;

-- Cleanup any existing test data
delete from order_items where order_id in (select id from orders where order_number like 'TEST-%');
delete from orders where order_number like 'TEST-%';

-- Create test order
insert into orders (order_number, customer_id, type, status, fulfilment, date_needed, subtotal, total, deposit_required, amount_paid, source)
values (
  'TEST-MULTI-001',
  (select id from customers limit 1),
  'pickup',
  'confirmed',
  'pickup',
  current_date,
  1500, 1500, 0, 0, 'test'
) returning id as order_id;

-- Add 2 items: 1 pastry (track_stock), 1 cake
-- Need product_id for pastry
insert into order_items (order_id, product_id, name, quantity, unit_price, line_total)
values (
  (select id from orders where order_number = 'TEST-MULTI-001'),
  (select id from products where track_stock = true limit 1),
  'Test Pastry',
  2,
  500,
  1000
);

insert into order_items (order_id, name, quantity, unit_price, line_total)
values (
  (select id from orders where order_number = 'TEST-MULTI-001'),
  'Test Cake',
  1,
  500,
  500
);

-- ============================================================
-- TEST 1: anon CANNOT select from any view
-- ============================================================
set role anon;

\echo 'TEST 1: anon access (should all fail)'
select 'orders_balance' as view, count(*) from orders_balance;  -- ERROR expected
select 'sales_daily' as view, count(*) from sales_daily;        -- ERROR expected

-- ============================================================
-- TEST 2: authenticated (manager) CAN select, sees RLS-filtered data
-- ============================================================
set role authenticated;
-- Simulate manager by setting request.jwt.claims
select set_config('request.jwt.claims', '{"role":"manager","sub":"manager-test-uuid"}', true)::text;

\echo 'TEST 2: manager access'
select 'orders_balance' as view, count(*) from orders_balance;
select 'sales_daily' as view, * from sales_daily order by day desc limit 5;

-- Verify multi-item order: revenue should be 1500 (not 2000 from fan-out)
select day, revenue, order_count from sales_daily where day = current_date;

-- ============================================================
-- TEST 3: superadmin CAN select all data
-- ============================================================
select set_config('request.jwt.claims', '{"role":"superadmin","sub":"superadmin-test-uuid"}', true)::text;

\echo 'TEST 3: superadmin access'
select 'orders_balance' as view, count(*) from orders_balance;
select 'sales_daily' as view, * from sales_daily order by day desc limit 5;

-- ============================================================
-- TEST 4: Verify security_invoker is set
-- ============================================================
\echo 'TEST 4: View options'
select viewname,
       pg_get_viewdef(oid) as definition,
       reloptions
from pg_class
where relname in ('orders_balance', 'sales_daily')
  and relnamespace = 'public'::regnamespace;

-- ============================================================
-- TEST 5: sales_daily_profit is dropped (0016)
-- ============================================================
\echo 'TEST 5: sales_daily_profit dropped'
select exists (
  select 1 from pg_views where schemaname = 'public' and viewname = 'sales_daily_profit'
) as profit_view_exists;  -- should be false

-- ============================================================
-- CLEANUP
-- ============================================================
set role service_role;
delete from order_items where order_id in (select id from orders where order_number like 'TEST-%');
delete from orders where order_number like 'TEST-%';

\echo 'All tests complete.'