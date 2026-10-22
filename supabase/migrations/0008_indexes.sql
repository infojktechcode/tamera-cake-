-- Indexes for the queries the app actually runs.
--
-- Postgres does not index the referencing side of a foreign key, and the
-- dashboard and the capacity check both join and filter on these columns.
-- Without them the orders board gets slower as the shop's history grows.

create index if not exists orders_created_at_idx on orders (created_at desc);
create index if not exists orders_date_needed_idx on orders (date_needed);
create index if not exists orders_status_idx on orders (status);
create index if not exists order_items_order_id_idx on order_items (order_id);
create index if not exists cake_details_order_item_id_idx on cake_details (order_item_id);
create index if not exists payments_order_id_idx on payments (order_id);
create index if not exists activity_log_record_id_idx on activity_log (record_id);
create index if not exists products_category_id_idx on products (category_id);
create index if not exists products_available_sort_idx on products (available, sort_order);
