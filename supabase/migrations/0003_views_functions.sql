-- views/functions
create or replace function next_order_number() returns text as $$
  select 'TCB-' || lpad(nextval('order_number_seq')::text, 4, '0');
$$ language sql;

-- cake load for date (counts non-cancelled cake orders on a date)
create or replace function cake_load_for_date(d date) returns int
language sql stable as $$
  select count(*)::int
  from orders o
  join order_items oi on oi.order_id = o.id
  join cake_details cd on cd.order_item_id = oi.id
  where o.date_needed = d
    and o.status <> 'cancelled';
$$;

-- orders balance view
create or replace view orders_balance as
  select id, total, amount_paid, (total - amount_paid) as balance_due from orders;

-- sales daily (excludes cancelled)
create or replace view sales_daily as
  select
    (created_at at time zone 'Africa/Nairobi')::date as day,
    count(*)::int as order_count,
    coalesce(sum(total),0)::int as sales
  from orders
  where status <> 'cancelled'
  group by 1;

-- superadmin-only profit view
create or replace view sales_daily_profit as
  select
    (o.created_at at time zone 'Africa/Nairobi')::date as day,
    coalesce(sum(oi.line_total),0)::int as revenue,
    0::int as cost_placeholder,
    coalesce(sum(oi.line_total),0)::int as profit_placeholder
  from orders o
  left join order_items oi on oi.order_id = o.id
  where o.status <> 'cancelled'
  group by 1;
