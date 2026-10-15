-- stock reduce on new->confirmed, restore on cancel
create or replace function update_stock_on_status() returns trigger as $$
begin
  if (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    -- new -> confirmed: reduce
    if (old.status = 'new' and new.status = 'confirmed') then
      update products p set stock_qty = p.stock_qty - oi.quantity
        from order_items oi
        where oi.order_id = new.id and oi.product_id = p.id and p.track_stock = true;
    end if;
    -- confirmed -> cancelled: restore
    if (old.status = 'confirmed' and new.status = 'cancelled') then
      update products p set stock_qty = p.stock_qty + oi.quantity
        from order_items oi
        where oi.order_id = new.id and oi.product_id = p.id and p.track_stock = true;
    end if;
    -- also restore if was confirmed at any later stage then cancelled
    if (new.status = 'cancelled' and old.status in ('confirmed','deposit_paid','in_production','ready','out_for_delivery')) then
      update products p set stock_qty = p.stock_qty + oi.quantity
        from order_items oi
        where oi.order_id = new.id and oi.product_id = p.id and p.track_stock = true;
    end if;
  end if;
  return new;
end; $$ language plpgsql;

create trigger orders_status_stock
  after update on orders
  for each row execute function update_stock_on_status();

-- amount_paid = sum payments
create or replace function sync_amount_paid() returns trigger as $$
declare oid uuid;
begin
  oid := coalesce(new.order_id, old.order_id);
  update orders set amount_paid = coalesce((select sum(amount) from payments where order_id = oid),0)
    where id = oid;
  return coalesce(new, old);
end; $$ language plpgsql;

create trigger payments_sync
  after insert or update or delete on payments
  for each row execute function sync_amount_paid();
