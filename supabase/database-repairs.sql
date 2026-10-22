-- =============================================================================
-- One-time repairs for the live Supabase project.
--
-- The shop's database was created by hand, so it is missing a few things the
-- app needs. Paste this whole file into the Supabase dashboard
-- (SQL editor → New query → Run) and it is fixed. It is safe to run twice.
--
-- What it does:
--   1. Fixes the stock trigger: cancelling a confirmed order restored the
--      stock twice (see migrations/0007_stock_trigger_fix.sql).
--   2. Adds the indexes the dashboard and the capacity check need
--      (see migrations/0008_indexes.sql).
--   3. Adds `orders` to the Realtime publication, so a new order reaches the
--      dashboard instantly instead of waiting for the 20-second poll.
--   4. Pins `search_path` on the two security-definer helper functions.
-- =============================================================================

-- 1. the stock trigger -------------------------------------------------------
create or replace function update_stock_on_status() returns trigger as $$
begin
  if (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    -- new -> confirmed: the stock leaves the shelf
    if (old.status = 'new' and new.status = 'confirmed') then
      update products p set stock_qty = p.stock_qty - oi.quantity
        from order_items oi
        where oi.order_id = new.id and oi.product_id = p.id and p.track_stock = true;
    end if;

    -- any confirmed (or later) order -> cancelled: the stock comes back, once
    if (new.status = 'cancelled'
        and old.status in ('confirmed','deposit_paid','in_production','ready','out_for_delivery')) then
      update products p set stock_qty = p.stock_qty + oi.quantity
        from order_items oi
        where oi.order_id = new.id and oi.product_id = p.id and p.track_stock = true;
    end if;
  end if;
  return new;
end; $$ language plpgsql;

-- 2. indexes -----------------------------------------------------------------
create index if not exists orders_created_at_idx on orders (created_at desc);
create index if not exists orders_date_needed_idx on orders (date_needed);
create index if not exists orders_status_idx on orders (status);
create index if not exists order_items_order_id_idx on order_items (order_id);
create index if not exists cake_details_order_item_id_idx on cake_details (order_item_id);
create index if not exists payments_order_id_idx on payments (order_id);
create index if not exists activity_log_record_id_idx on activity_log (record_id);
create index if not exists products_category_id_idx on products (category_id);
create index if not exists products_available_sort_idx on products (available, sort_order);

-- 3. realtime ---------------------------------------------------------------
-- The dashboard listens for new orders; without this the table is not in the
-- publication and no event is ever delivered.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table orders;
  end if;
end $$;

-- 4. helper functions: pin the search path -----------------------------------
create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active = true);
$$;

create or replace function is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin' and active = true);
$$;
