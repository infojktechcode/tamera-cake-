-- 0017_fix_stock_trigger_double_restore.sql
-- Fix: Migration 0011 re-introduced the double-restore bug from 0004.
-- Two branches both matched confirmed → cancelled, restoring stock twice.
-- This migration consolidates to one rule per direction.

-- Stock reduction transitions (stock leaves shelf):
--   * new → confirmed              (WhatsApp walk-in flow)
--   * pending_payment → deposit_paid (M-Pesa online flow)
--
-- Stock restoration transitions (stock returns, ONCE):
--   * Any confirmed-or-later status → cancelled
--     (confirmed, deposit_paid, in_production, ready, out_for_delivery)
--   * pending_payment → cancelled: NO restore (stock never reduced)

create or replace function public.update_stock_on_status() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    -- Stock leaves shelf: new -> confirmed (WhatsApp flow)
    if (old.status = 'new' and new.status = 'confirmed') then
      update products p
      set stock_qty = p.stock_qty - oi.quantity
      from order_items oi
      where oi.order_id = new.id
        and oi.product_id = p.id
        and p.track_stock = true;
    end if;

    -- Stock leaves shelf: pending_payment -> deposit_paid (M-Pesa flow)
    if (old.status = 'pending_payment' and new.status = 'deposit_paid') then
      update products p
      set stock_qty = p.stock_qty - oi.quantity
      from order_items oi
      where oi.order_id = new.id
        and oi.product_id = p.id
        and p.track_stock = true;
    end if;

    -- Stock returns ONCE: any confirmed-or-later status -> cancelled
    -- Covers: confirmed, deposit_paid, in_production, ready, out_for_delivery
    if (new.status = 'cancelled'
        and old.status in ('confirmed', 'deposit_paid', 'in_production', 'ready', 'out_for_delivery')) then
      update products p
      set stock_qty = p.stock_qty + oi.quantity
      from order_items oi
      where oi.order_id = new.id
        and oi.product_id = p.id
        and p.track_stock = true;
    end if;

    -- pending_payment -> cancelled: NO stock restore (stock was never reduced)
  end if;
  return new;
end;
$$;

-- Re-attach trigger (idempotent)
drop trigger if exists orders_status_stock on public.orders;
create trigger orders_status_stock
  after update on public.orders
  for each row execute function public.update_stock_on_status();