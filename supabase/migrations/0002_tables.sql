-- tables
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role user_role not null default 'manager',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('cake','pastry')),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id),
  name text not null,
  slug text unique not null,
  description text,
  image_url text,
  price int not null default 0,
  track_stock boolean not null default false,
  stock_qty int not null default 0,
  low_stock_level int not null default 0,
  available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table product_costs (
  product_id uuid primary key references products(id) on delete cascade,
  cost_price int not null default 0
);

create table cake_flavours (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_per_kg int not null,
  image_url text,
  available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cake_sizes (
  id uuid primary key default gen_random_uuid(),
  kg numeric not null,
  available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table design_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  extra_fee int not null default 0,
  requires_quote boolean not null default false,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fee int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table blocked_dates (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  reason text,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  notes text,
  source text check (source in ('online','walk_in')) default 'online',
  consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- order number sequence
create sequence order_number_seq start 1;

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references customers(id),
  type order_type not null default 'mixed',
  status order_status not null default 'new',
  fulfilment fulfilment not null default 'pickup',
  delivery_zone_id uuid references delivery_zones(id),
  delivery_address text,
  delivery_fee int not null default 0,
  date_needed date,
  time_needed time,
  subtotal int not null default 0,
  total int not null default 0,
  deposit_required int not null default 0,
  amount_paid int not null default 0,
  notes text,
  source order_source not null default 'online',
  price_needs_quote boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  name text not null,
  quantity int not null default 1,
  unit_price int not null default 0,
  line_total int not null default 0,
  created_at timestamptz not null default now()
);

create table cake_details (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  size_kg numeric not null,
  flavour_id uuid references cake_flavours(id),
  flavour_name text not null,
  design_tier_id uuid references design_tiers(id),
  design_tier_name text not null,
  design_description text,
  cake_message text,
  allergies text,
  reference_photos text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  method pay_method not null,
  amount int not null,
  reference_code text,
  recorded_by uuid references profiles(id),
  reason text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default current_date,
  category text not null,
  description text,
  amount int not null,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table settings (
  id int primary key default 1 check (id = 1),
  shop_name text not null default 'Tamera''s Cakes & Bakery',
  whatsapp_number text not null,
  address text,
  opening_hours jsonb not null default '{}'::jsonb,
  min_lead_days int not null default 2,
  daily_cake_limit int not null default 6,
  deposit_percent int not null default 50,
  deposit_threshold_kg numeric not null default 3,
  message_templates jsonb not null default '{}'::jsonb,
  payment_details text,
  updated_at timestamptz not null default now()
);

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

-- updated_at trigger
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

do $$ declare t text; begin
  for t in select unnest(array['profiles','categories','products','cake_flavours','delivery_zones','customers','orders','expenses']) loop
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end $$;
