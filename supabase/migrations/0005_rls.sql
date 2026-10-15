alter table profiles enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table product_costs enable row level security;
alter table cake_flavours enable row level security;
alter table cake_sizes enable row level security;
alter table design_tiers enable row level security;
alter table delivery_zones enable row level security;
alter table blocked_dates enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table cake_details enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table settings enable row level security;
alter table activity_log enable row level security;

-- helpers
create or replace function is_staff() returns boolean language sql stable security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and active = true);
$$;
create or replace function is_superadmin() returns boolean language sql stable security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'superadmin' and active = true);
$$;

-- public read: categories, products, flavours, sizes, tiers, zones, blocked_dates
create policy "anon_read_categories" on categories for select to anon using (active = true);
create policy "anon_read_products" on products for select to anon using (available = true);
create policy "anon_read_flavours" on cake_flavours for select to anon using (available = true);
create policy "anon_read_sizes" on cake_sizes for select to anon using (available = true);
create policy "anon_read_tiers" on design_tiers for select to anon using (true);
create policy "anon_read_zones" on delivery_zones for select to anon using (active = true);
create policy "anon_read_blocked" on blocked_dates for select to anon using (true);
create policy "anon_read_settings" on settings for select to anon using (true);

-- staff read all of the menu/public tables
create policy "staff_read_categories" on categories for select to authenticated using (is_staff());
create policy "staff_read_products" on products for select to authenticated using (is_staff());
create policy "staff_read_flavours" on cake_flavours for select to authenticated using (is_staff());
create policy "staff_read_sizes" on cake_sizes for select to authenticated using (is_staff());
create policy "staff_read_tiers" on design_tiers for select to authenticated using (is_staff());
create policy "staff_read_zones" on delivery_zones for select to authenticated using (is_staff());
create policy "staff_read_blocked" on blocked_dates for select to authenticated using (is_staff());
create policy "staff_read_settings" on settings for select to authenticated using (is_staff());

-- product_costs: superadmin only
create policy "superadmin_costs_all" on product_costs for all to authenticated
  using (is_superadmin()) with check (is_superadmin());

-- profiles
create policy "self_read_profile" on profiles for select to authenticated using (id = auth.uid());
create policy "superadmin_read_profiles" on profiles for select to authenticated using (is_superadmin());
create policy "superadmin_write_profiles" on profiles for all to authenticated
  using (is_superadmin()) with check (is_superadmin());

-- customers
create policy "staff_read_customers" on customers for select to authenticated using (is_staff());
create policy "staff_write_customers" on customers for insert to authenticated with check (is_staff());
create policy "staff_update_customers" on customers for update to authenticated using (is_staff()) with check (is_staff());
create policy "superadmin_delete_customers" on customers for delete to authenticated using (is_superadmin());

-- orders
create policy "staff_read_orders" on orders for select to authenticated using (is_staff());
create policy "staff_write_orders" on orders for insert to authenticated with check (is_staff());
create policy "staff_update_orders" on orders for update to authenticated using (is_staff()) with check (is_staff());
create policy "superadmin_delete_orders" on orders for delete to authenticated using (is_superadmin());

-- order_items
create policy "staff_read_items" on order_items for select to authenticated using (is_staff());
create policy "staff_write_items" on order_items for all to authenticated using (is_staff()) with check (is_staff());

-- cake_details
create policy "staff_read_cake" on cake_details for select to authenticated using (is_staff());
create policy "staff_write_cake" on cake_details for all to authenticated using (is_staff()) with check (is_staff());

-- payments
create policy "staff_read_pay" on payments for select to authenticated using (is_staff());
create policy "staff_write_pay" on payments for insert to authenticated with check (is_staff());
create policy "staff_update_pay" on payments for update to authenticated using (is_superadmin()) with check (is_superadmin());

-- expenses: superadmin only
create policy "superadmin_expenses_all" on expenses for all to authenticated
  using (is_superadmin()) with check (is_superadmin());

-- categories write: staff
create policy "staff_write_categories" on categories for insert to authenticated with check (is_staff());
create policy "staff_update_categories" on categories for update to authenticated using (is_staff()) with check (is_staff());
create policy "superadmin_delete_categories" on categories for delete to authenticated using (is_superadmin());

-- products write: staff (no delete for manager enforced in app + policy allows superadmin delete only)
create policy "staff_write_products" on products for insert to authenticated with check (is_staff());
create policy "staff_update_products" on products for update to authenticated using (is_staff()) with check (is_staff());
create policy "superadmin_delete_products" on products for delete to authenticated using (is_superadmin());

-- flavours/sizes/tiers write staff
create policy "staff_write_flavours" on cake_flavours for all to authenticated using (is_staff()) with check (is_staff());
create policy "staff_write_sizes" on cake_sizes for all to authenticated using (is_staff()) with check (is_staff());
create policy "staff_write_tiers" on design_tiers for all to authenticated using (is_staff()) with check (is_staff());
create policy "staff_write_zones" on delivery_zones for all to authenticated using (is_staff()) with check (is_staff());
create policy "staff_write_blocked" on blocked_dates for all to authenticated using (is_staff()) with check (is_staff());

-- settings: superadmin update, staff read
create policy "superadmin_write_settings" on settings for update to authenticated using (is_superadmin()) with check (is_superadmin());

-- activity_log: superadmin read, insert via service; staff cannot read
create policy "superadmin_read_activity" on activity_log for select to authenticated using (is_superadmin());

-- categories/numerous: nothing for anon writes (no insert policies for anon)
