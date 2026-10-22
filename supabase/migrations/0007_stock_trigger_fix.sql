-- Fix: cancelling a confirmed order restored the stock twice.
--
-- `update_stock_on_status` (migration 0004) had two branches that both
-- matched `confirmed -> cancelled`:
--
--   if (old.status = 'confirmed' and new.status = 'cancelled') then ... + qty
--   if (new.status = 'cancelled' and old.status in ('confirmed', ...)) then ... + qty
--
-- The second branch already covers the first, so the stock came back twice:
-- a pastry with 20 in stock fell to 18 when the order was confirmed and then
-- jumped to 22 when the order was cancelled.
--
-- The fix keeps one rule for each direction:
--   * new -> confirmed        : the stock leaves the shelf
--   * confirmed (or later) -> cancelled : the stock comes back, once
--
-- Verified live on 2026-10-22 (see docs/DECISIONS.md).

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
