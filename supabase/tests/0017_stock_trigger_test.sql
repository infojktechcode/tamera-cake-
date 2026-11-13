-- supabase/tests/0017_stock_trigger_test.sql
-- Tests for the idempotent stock trigger (migration 0017)
-- Run after migration 0017 is applied

-- ============================================================
-- SETUP: Create test products and orders
-- ============================================================

set role service_role;

-- Cleanup any existing test data
delete from order_items where order_id in (select id from orders where order_number like 'TEST-STOCK-%');
delete from orders where order_number like 'TEST-STOCK-%';
delete from products where name like 'TEST STOCK%';

-- Create test products with known stock
insert into products (name, track_stock, stock_qty, unit_type)
values
  ('TEST STOCK Pastry A', true, 100, 'pcs'),
  ('TEST STOCK Pastry B', true, 50, 'pcs'),
  ('TEST STOCK Cake C', false, 0, 'kg'); -- cakes don't track stock

-- Get product IDs
\set pastry_a_id (select id from products where name = 'TEST STOCK Pastry A')
\set pastry_b_id (select id from products where name = 'TEST STOCK Pastry B')

-- ============================================================
-- TEST 1: new -> confirmed reduces stock ONCE
-- ============================================================

\echo '=== TEST 1: new -> confirmed (WhatsApp flow) ==='

insert into orders (order_number, customer_id, type, status, fulfilment, date_needed, subtotal, total, deposit_required, amount_paid, source)
values (
  'TEST-STOCK-001',
  (select id from customers limit 1),
  'pickup',
  'new',
  'pickup',
  current_date,
  2000, 2000, 0, 0, 'test'
) returning id;

\set order_1_id (select id from orders where order_number = 'TEST-STOCK-001')

insert into order_items (order_id, product_id, name, quantity, unit_price, line_total)
values
  (:order_1_id, :pastry_a_id, 'TEST STOCK Pastry A', 3, 500, 1500),
  (:order_1_id, :pastry_b_id, 'TEST STOCK Pastry B', 1, 500, 500);

-- Check stock before
select 'BEFORE confirm' as stage, name, stock_qty from products where name like 'TEST STOCK%';

-- Transition: new -> confirmed
update orders set status = 'confirmed' where id = :order_1_id;

-- Check stock after
select 'AFTER confirm' as stage, name, stock_qty from products where name like 'TEST STOCK%';
-- Expected: Pastry A: 97 (100-3), Pastry B: 49 (50-1)

-- ============================================================
-- TEST 2: confirmed -> cancelled restores stock ONCE (not twice!)
-- ============================================================

\echo '=== TEST 2: confirmed -> cancelled (restore once) ==='

-- Transition: confirmed -> cancelled
update orders set status = 'cancelled' where id = :order_1_id;

-- Check stock after cancel
select 'AFTER cancel' as stage, name, stock_qty from products where name like 'TEST STOCK%';
-- Expected: Pastry A: 100 (back to original), Pastry B: 50 (back to original)
-- NOT 103/53 (which would be double-restore)

-- ============================================================
-- TEST 3: pending_payment -> deposit_paid reduces stock ONCE (M-Pesa flow)
-- ============================================================

\echo '=== TEST 3: pending_payment -> deposit_paid (M-Pesa flow) ==='

insert into orders (order_number, customer_id, type, status, fulfilment, date_needed, subtotal, total, deposit_required, amount_paid, source)
values (
  'TEST-STOCK-002',
  (select id from customers limit 1),
  'delivery',
  'pending_payment',
  'delivery',
  current_date,
  1500, 1500, 500, 0, 'mpesa'
) returning id;

\set order_2_id (select id from orders where order_number = 'TEST-STOCK-002')

insert into order_items (order_id, product_id, name, quantity, unit_price, line_total)
values
  (:order_2_id, :pastry_a_id, 'TEST STOCK Pastry A', 2, 500, 1000),
  (:order_2_id, :pastry_b_id, 'TEST STOCK Pastry B', 1, 500, 500);

-- Check stock before
select 'BEFORE deposit_paid' as stage, name, stock_qty from products where name like 'TEST STOCK%';

-- Transition: pending_payment -> deposit_paid
update orders set status = 'deposit_paid' where id = :order_2_id;

-- Check stock after
select 'AFTER deposit_paid' as stage, name, stock_qty from products where name like 'TEST STOCK%';
-- Expected: Pastry A: 95 (97-2), Pastry B: 49 (50-1)

-- ============================================================
-- TEST 4: deposit_paid -> cancelled restores stock ONCE
-- ============================================================

\echo '=== TEST 4: deposit_paid -> cancelled (restore once) ==='

-- Transition: deposit_paid -> cancelled
update orders set status = 'cancelled' where id = :order_2_id;

-- Check stock after cancel
select 'AFTER cancel deposit_paid' as stage, name, stock_qty from products where name like 'TEST STOCK%';
-- Expected: Pastry A: 97 (95+2), Pastry B: 50 (49+1)

-- ============================================================
-- TEST 5: pending_payment -> cancelled does NOT restore stock
-- ============================================================

\echo '=== TEST 5: pending_payment -> cancelled (no restore) ==='

insert into orders (order_number, customer_id, type, status, fulfilment, date_needed, subtotal, total, deposit_required, amount_paid, source)
values (
  'TEST-STOCK-003',
  (select id from customers limit 1),
  'pickup',
  'pending_payment',
  'pickup',
  current_date,
  1000, 1000, 500, 0, 'mpesa'
) returning id;

\set order_3_id (select id from orders where order_number = 'TEST-STOCK-003')

insert into order_items (order_id, product_id, name, quantity, unit_price, line_total)
values
  (:order_3_id, :pastry_a_id, 'TEST STOCK Pastry A', 5, 200, 1000);

-- Check stock before
select 'BEFORE cancel pending' as stage, name, stock_qty from products where name like 'TEST STOCK%';

-- Transition: pending_payment -> cancelled (stock was NEVER reduced)
update orders set status = 'cancelled' where id = :order_3_id;

-- Check stock after - should be UNCHANGED
select 'AFTER cancel pending' as stage, name, stock_qty from products where name like 'TEST STOCK%';
-- Expected: Pastry A: 97 (unchanged), Pastry B: 50 (unchanged)

-- ============================================================
-- TEST 6: Full lifecycle - new -> confirmed -> in_production -> ready -> out_for_delivery -> cancelled
-- Each status change should not affect stock, only the final cancel restores once
-- ============================================================

\echo '=== TEST 6: Full lifecycle through production ==='

insert into orders (order_number, customer_id, type, status, fulfilment, date_needed, subtotal, total, deposit_required, amount_paid, source)
values (
  'TEST-STOCK-004',
  (select id from customers limit 1),
  'delivery',
  'new',
  'delivery',
  current_date + interval '1 day',
  2000, 2000, 0, 0, 'test'
) returning id;

\set order_4_id (select id from orders where order_number = 'TEST-STOCK-004')

insert into order_items (order_id, product_id, name, quantity, unit_price, line_total)
values
  (:order_4_id, :pastry_a_id, 'TEST STOCK Pastry A', 10, 200, 2000);

-- Check stock before
select 'BEFORE lifecycle' as stage, name, stock_qty from products where name like 'TEST STOCK%';

-- new -> confirmed (stock reduced)
update orders set status = 'confirmed' where id = :order_4_id;
select 'AFTER confirmed' as stage, name, stock_qty from products where name like 'TEST STOCK%';

-- confirmed -> in_production (no stock change)
update orders set status = 'in_production' where id = :order_4_id;
select 'AFTER in_production' as stage, name, stock_qty from products where name like 'TEST STOCK%';

-- in_production -> ready (no stock change)
update orders set status = 'ready' where id = :order_4_id;
select 'AFTER ready' as stage, name, stock_qty from products where name like 'TEST STOCK%';

-- ready -> out_for_delivery (no stock change)
update orders set status = 'out_for_delivery' where id = :order_4_id;
select 'AFTER out_for_delivery' as stage, name, stock_qty from products where name like 'TEST STOCK%';

-- out_for_delivery -> cancelled (stock restored ONCE)
update orders set status = 'cancelled' where id = :order_4_id;
select 'AFTER cancelled' as stage, name, stock_qty from products where name like 'TEST STOCK%';
-- Expected: Pastry A back to 97 (was 87 after confirm, +10 on cancel)

-- ============================================================
-- TEST 7: Multiple items in one order - all tracked correctly
-- ============================================================

\echo '=== TEST 7: Multi-item order ==='

insert into orders (order_number, customer_id, type, status, fulfilment, date_needed, subtotal, total, deposit_required, amount_paid, source)
values (
  'TEST-STOCK-005',
  (select id from customers limit 1),
  'pickup',
  'new',
  'pickup',
  current_date,
  5000, 5000, 0, 0, 'test'
) returning id;

\set order_5_id (select id from orders where order_number = 'TEST-STOCK-005')

insert into order_items (order_id, product_id, name, quantity, unit_price, line_total)
values
  (:order_5_id, :pastry_a_id, 'TEST STOCK Pastry A', 4, 500, 2000),
  (:order_5_id, :pastry_b_id, 'TEST STOCK Pastry B', 6, 500, 3000);

-- Check stock before
select 'BEFORE multi-item confirm' as stage, name, stock_qty from products where name like 'TEST STOCK%';

-- new -> confirmed
update orders set status = 'confirmed' where id = :order_5_id;
select 'AFTER multi-item confirm' as stage, name, stock_qty from products where name like 'TEST STOCK%';
-- Expected: Pastry A: 93 (97-4), Pastry B: 44 (50-6)

-- confirmed -> cancelled
update orders set status = 'cancelled' where id = :order_5_id;
select 'AFTER multi-item cancel' as stage, name, stock_qty from products where name like 'TEST STOCK%';
-- Expected: Pastry A: 97, Pastry B: 50 (back to before this test)

-- ============================================================
-- CLEANUP
-- ============================================================

\echo '=== CLEANUP ==='

delete from order_items where order_id in (select id from orders where order_number like 'TEST-STOCK-%');
delete from orders where order_number like 'TEST-STOCK-%';
delete from products where name like 'TEST STOCK%';

select 'All stock trigger tests complete.' as result;